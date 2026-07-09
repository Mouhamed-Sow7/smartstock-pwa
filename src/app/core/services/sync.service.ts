import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OfflineService, VentePending, ProduitPending } from './offline.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SyncService {
  // ─── Signaux réactifs ────────────────────────────────────────
  readonly estEnLigne = signal<boolean>(navigator.onLine);
  readonly ventesPendingCount = signal<number>(0);
  readonly produitsPendingCount = signal<number>(0);
  readonly estEnSync = signal<boolean>(false);

  readonly afficherBandeau = computed(() =>
    !this.estEnLigne() || this.ventesPendingCount() > 0 || this.produitsPendingCount() > 0
  );

  readonly totalPendingCount = computed(() =>
    this.ventesPendingCount() + this.produitsPendingCount()
  );

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
    if (!tenantId || tenantId === 'default') return;
    const [ventes, produits] = await Promise.all([
      this.offline.compterVentesPending(tenantId),
      this.offline.compterProduitsPending(tenantId),
    ]);
    this.ventesPendingCount.set(ventes);
    this.produitsPendingCount.set(produits);
    if ((ventes > 0 || produits > 0) && this.estEnLigne() && !this.estEnSync()) {
      this.synchroniser();
    }
  }

  async synchroniser(): Promise<void> {
    if (this.estEnSync() || !this.estEnLigne()) return;
    const tenantId = this.auth.getTenantId();
    if (!tenantId || tenantId === 'default') return;

    const [ventes, produits] = await Promise.all([
      this.offline.getVentesPending(tenantId),
      this.offline.getProduitsPending(tenantId),
    ]);
    if (ventes.length === 0 && produits.length === 0) return;

    this.estEnSync.set(true);

    // 1. Sync produits en premier (les ventes peuvent référencer ces produits)
    for (const p of produits) {
      await this.syncProduit(p);
    }
    await this.offline.nettoyerProduitsSynced();

    // 2. Sync ventes
    for (const v of ventes) {
      await this.syncVente(v);
    }
    await this.offline.nettoyerVentesSynced();

    await this.rafraichirCompteur();
    this.estEnSync.set(false);
  }

  private async syncProduit(p: any): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/produits`, {
          nom: p.nom,
          prix: p.prix,
          prixAchat: p.prixAchat,
          stock: p.stock,
          seuilAlerte: p.seuilAlerte,
          codeBarres: p.codeBarres,
          categorie: p.categorie,
        }),
      );
      await this.offline.marquerProduitSynced(p.id!);
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status >= 400 && status < 500) {
        await this.offline.marquerProduitError(p.id!, err?.error?.message || 'Erreur');
      }
    }
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
      // Retry x2 avec timeout 8s (évite faux offline sur cold-start Render)
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

  // ─── Créer un produit (online ou offline) ────────────────────
  async creerProduit(payload: Omit<ProduitPending, 'id' | 'statut' | 'createdAt'>): Promise<'online' | 'offline'> {
    if (this.estEnLigne()) {
      try {
        const timeout$ = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000),
        );
        await Promise.race([
          firstValueFrom(this.http.post(`${environment.apiUrl}/produits`, payload)),
          timeout$,
        ]);
        return 'online';
      } catch { /* bascule offline */ }
    }
    await this.offline.ajouterProduitPending({
      ...payload,
      createdAt: new Date().toISOString(),
      statut: 'pending',
    });
    await this.rafraichirCompteur();
    return 'offline';
  }
}
