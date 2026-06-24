import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OfflineService, VentePending } from './offline.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SyncService {
  // ─── Signaux réactifs ────────────────────────────────────────
  readonly estEnLigne = signal<boolean>(navigator.onLine);
  readonly ventesPendingCount = signal<number>(0);
  readonly estEnSync = signal<boolean>(false);

  readonly afficherBandeau = computed(() => !this.estEnLigne() || this.ventesPendingCount() > 0);

  constructor(
    private http: HttpClient,
    private offline: OfflineService,
    private auth: AuthService,
  ) {
    this.ecouterConnexion();
    this.rafraichirCompteur();
    // Enregistrement du callback post-login pour détecter les ventes
    // offline stockées avant que la session soit établie
    this.auth.onLoginSuccess = () => this.rafraichirCompteur();
  }

  // ─── Écoute online/offline ───────────────────────────────────

  private ecouterConnexion(): void {
    window.addEventListener('online', async () => {
      this.estEnLigne.set(true);
      // Attendre 1.2s que le réseau soit stable avant de tenter la sync
      setTimeout(() => this.synchroniser(), 1200);
    });

    window.addEventListener('offline', () => {
      this.estEnLigne.set(false);
    });
  }

  // ─── Compteur ventes en attente ──────────────────────────────

  async rafraichirCompteur(): Promise<void> {
    const tenantId = this.auth.getTenantId();
    // Ne pas compter si la session n'est pas établie (tenantId serait 'default')
    if (!tenantId || tenantId === 'default') return;
    const count = await this.offline.compterVentesPending(tenantId);
    this.ventesPendingCount.set(count);
    // Si en ligne avec des ventes en attente, déclencher la sync
    if (count > 0 && this.estEnLigne() && !this.estEnSync()) {
      this.synchroniser();
    }
  }

  // ─── Synchronisation ─────────────────────────────────────────

  async synchroniser(): Promise<void> {
    if (this.estEnSync() || !this.estEnLigne()) return;

    const tenantId = this.auth.getTenantId();
    if (!tenantId || tenantId === 'default') return;

    const ventes = await this.offline.getVentesPending(tenantId);
    if (ventes.length === 0) return;

    this.estEnSync.set(true);

    for (const vente of ventes) {
      await this.syncVente(vente);
    }

    await this.offline.nettoyerVentesSynced();
    await this.rafraichirCompteur();
    this.estEnSync.set(false);
  }

  private async syncVente(vente: VentePending): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/ventes`, {
          lignes: vente.lignes,
          montantTotal: vente.montantTotal,
          modePaiement: vente.modePaiement,
          createdAt: vente.createdAt,
        }),
      );
      await this.offline.marquerVenteSynced(vente.id!);
    } catch (err: any) {
      const status = err?.status ?? 0;
      // Erreur métier définitive (400, 422) → marquer en erreur pour ne pas
      // reboucler sur une vente corrompue
      if (status === 400 || status === 422) {
        const msg = err?.error?.message || 'Données invalides';
        await this.offline.marquerVenteError(vente.id!, msg);
      }
      // Erreur réseau temporaire → on garde statut 'pending' pour retry
    }
  }

  // ─── Ajouter une vente (online ou offline) ───────────────────

  async creerVente(
    payload: Omit<VentePending, 'id' | 'statut' | 'createdAt'>,
  ): Promise<'online' | 'offline'> {
    const venteComplete = {
      ...payload,
      createdAt: new Date().toISOString(),
      statut: 'pending' as const,
    };

    if (this.estEnLigne()) {
      try {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/ventes`, venteComplete));
        return 'online';
      } catch {
        // Échec réseau → bascule offline
      }
    }

    await this.offline.ajouterVentePending(venteComplete);
    await this.rafraichirCompteur();
    return 'offline';
  }
}
