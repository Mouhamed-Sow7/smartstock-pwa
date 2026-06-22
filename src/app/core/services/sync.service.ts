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
  }

  // ─── Écoute online/offline ───────────────────────────────────

  private ecouterConnexion(): void {
    window.addEventListener('online', async () => {
      this.estEnLigne.set(true);
      await this.synchroniser();
    });

    window.addEventListener('offline', () => {
      this.estEnLigne.set(false);
    });
  }

  // ─── Compteur ventes en attente ──────────────────────────────

  async rafraichirCompteur(): Promise<void> {
    const tenantId = this.auth.getTenantId();
    if (!tenantId) return;
    const count = await this.offline.compterVentesPending(tenantId);
    this.ventesPendingCount.set(count);
  }

  // ─── Synchronisation ─────────────────────────────────────────

  async synchroniser(): Promise<void> {
    if (this.estEnSync() || !this.estEnLigne()) return;

    const tenantId = this.auth.getTenantId();
    if (!tenantId) return;

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
      const msg = err?.error?.message || 'Erreur réseau';
      await this.offline.marquerVenteError(vente.id!, msg);
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
      // Retry x2 avec timeout 8s — évite le faux offline sur cold-start Render
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const timeout$ = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000),
          );
          await Promise.race([
            firstValueFrom(this.http.post(`${environment.apiUrl}/ventes`, venteComplete)),
            timeout$,
          ]);
          return 'online';
        } catch {
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    await this.offline.ajouterVentePending(venteComplete);
    await this.rafraichirCompteur();
    return 'offline';
  }
}
