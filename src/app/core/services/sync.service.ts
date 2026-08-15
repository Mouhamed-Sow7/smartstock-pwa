import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { OfflineService, VentePending, ProduitPending, StockPending, CachedProduit } from './offline.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SyncService {
  // ─── Signaux réactifs ────────────────────────────────────────
  readonly estEnLigne = signal<boolean>(navigator.onLine);
  readonly ventesPendingCount = signal<number>(0);
  readonly produitsPendingCount = signal<number>(0);
  readonly stocksPendingCount = signal<number>(0);
  readonly estEnSync = signal<boolean>(false);

  readonly afficherBandeau = computed(() =>
    !this.estEnLigne() || this.ventesPendingCount() > 0 || this.produitsPendingCount() > 0 || this.stocksPendingCount() > 0
  );

  readonly totalPendingCount = computed(() =>
    this.ventesPendingCount() + this.produitsPendingCount() + this.stocksPendingCount()
  );

  constructor(
    private http: HttpClient,
    private offline: OfflineService,
    private auth: AuthService,
    private snack: MatSnackBar,
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
      setTimeout(() => {
        this.synchroniser();
        // Pull immédiat des produits en plus du push des ventes/stocks en
        // attente : sans ça, un produit créé ailleurs (autre session/appareil)
        // pendant qu'on était hors ligne restait invisible pour le scan tant
        // que le polling 60s ou une réouverture d'écran ne l'avait pas repris.
        const tenantId = this.auth.getTenantId();
        if (tenantId && tenantId !== 'default') {
          this.offline.syncProduitsFromServer(tenantId);
        }
      }, 1200);
    });

    window.addEventListener('offline', () => {
      this.estEnLigne.set(false);
    });
  }

  // ─── Compteur ventes en attente ──────────────────────────────

  async rafraichirCompteur(): Promise<void> {
    const tenantId = this.auth.getTenantId();
    if (!tenantId || tenantId === 'default') return;
    const [ventes, produits, stocks] = await Promise.all([
      this.offline.compterVentesPending(tenantId),
      this.offline.compterProduitsPending(tenantId),
      this.offline.compterStocksPending(tenantId),
    ]);
    this.ventesPendingCount.set(ventes);
    this.produitsPendingCount.set(produits);
    this.stocksPendingCount.set(stocks);
    if ((ventes > 0 || produits > 0 || stocks > 0) && this.estEnLigne() && !this.estEnSync()) {
      this.synchroniser();
    }
  }

  async synchroniser(): Promise<void> {
    if (this.estEnSync() || !this.estEnLigne()) return;
    const tenantId = this.auth.getTenantId();
    if (!tenantId || tenantId === 'default') return;

    const [ventes, produits, stocks] = await Promise.all([
      this.offline.getVentesPending(tenantId),
      this.offline.getProduitsPending(tenantId),
      this.offline.getStocksPending(tenantId),
    ]);
    if (ventes.length === 0 && produits.length === 0 && stocks.length === 0) return;

    this.estEnSync.set(true);

    // Tracking pour la notif de fin de sync (le bandeau qui disparaît tout
    // seul n'était pas assez visible — l'utilisateur ne savait jamais si sa
    // vente offline avait vraiment fini par partir). undefined (retry réseau
    // temporaire) n'est ni un succès ni un échec définitif -> ignoré ici.
    let ok = 0;
    let echecs = 0;
    const compter = (r: boolean | undefined) => {
      if (r === true) ok++;
      else if (r === false) echecs++;
    };

    // 1. Sync produits en premier (les réassorts/ventes peuvent référencer ces produits)
    for (const p of produits) {
      compter(await this.syncProduit(p));
    }
    await this.offline.nettoyerProduitsSynced();

    // 2. Sync réassorts (ajustements de stock patron)
    for (const s of stocks) {
      compter(await this.syncStock(s));
    }
    await this.offline.nettoyerStocksSynced();

    // 3. Sync ventes
    for (const v of ventes) {
      compter(await this.syncVente(v));
    }
    await this.offline.nettoyerVentesSynced();

    await this.rafraichirCompteur();
    this.estEnSync.set(false);
    this.notifierResultatSync(ok, echecs);
  }

  // ─── Notification de fin de sync ──────────────────────────────
  // `undefined` en cas d'échec réseau temporaire (retry au prochain cycle,
  // pas encore un vrai échec) : on ne compte que succès et échecs définitifs
  // dans le message, pour ne pas alarmer sur une simple reconnexion en cours.
  private notifierResultatSync(ok: number, echecs: number): void {
    if (ok === 0 && echecs === 0) return; // rien à synchroniser, silence total
    if (echecs === 0) {
      this.snack.open(
        `✓ ${ok} vente${ok > 1 ? 's' : ''}/élément${ok > 1 ? 's' : ''} synchronisé${ok > 1 ? 's' : ''}`,
        '✕',
        { duration: 3500, panelClass: 'snack-success' },
      );
    } else if (ok === 0) {
      this.snack.open(
        `⚠ ${echecs} élément${echecs > 1 ? 's' : ''} en erreur de synchronisation`,
        '✕',
        { duration: 5000, panelClass: 'snack-warn' },
      );
    } else {
      this.snack.open(
        `${ok} synchronisé${ok > 1 ? 's' : ''}, ${echecs} en erreur`,
        '✕',
        { duration: 5000, panelClass: 'snack-warn' },
      );
    }
  }

  // Retourne true (synchronisé), false (échec définitif, ne reboucle plus),
  // ou undefined (erreur réseau temporaire, reste 'pending' pour retry —
  // ne doit pas compter comme un échec dans la notif de fin de sync).
  private async syncProduit(p: ProduitPending): Promise<boolean | undefined> {
    try {
      const res: any = await firstValueFrom(
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
      // Remplace l'entrée temporaire du cache (temp_...) par le vrai produit serveur
      // + met à jour toute vente/réassort déjà en attente qui référençait ce temp_id
      // (voir remapProduitIdDansPending pour le détail du bug que ça corrige).
      if (p.tempId && res?.data?._id) {
        await this.offline.remplacerProduitTemp(p.tempId, { ...res.data, tenantId: p.tenantId });
        await this.offline.remapProduitIdDansPending(p.tempId, res.data._id);
      }
      return true;
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status >= 400 && status < 500) {
        await this.offline.marquerProduitError(p.id!, err?.error?.message || 'Erreur');
        return false;
      }
      // Erreur réseau temporaire → reste 'pending', on retente au prochain cycle
      return undefined;
    }
  }

  private async syncStock(s: StockPending): Promise<boolean | undefined> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/produits/${s.produitId}/stock`, {
          quantite: s.quantite,
          type: s.type,
        }),
      );
      await this.offline.marquerStockSynced(s.id!);
      return true;
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status >= 400 && status < 500) {
        // Produit introuvable / erreur métier définitive → ne pas reboucler indéfiniment
        await this.offline.marquerStockError(s.id!, err?.error?.message || 'Erreur');
        return false;
      }
      // Erreur réseau temporaire → reste 'pending'
      return undefined;
    }
  }

  private async syncVente(vente: VentePending): Promise<boolean | undefined> {
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
      return true;
    } catch (err: any) {
      const status = err?.status ?? 0;
      // Erreur métier définitive (400, 422) → marquer en erreur pour ne pas
      // reboucler sur une vente corrompue
      if (status === 400 || status === 422) {
        const msg = err?.error?.message || 'Données invalides';
        await this.offline.marquerVenteError(vente.id!, msg);
        return false;
      }
      // Erreur réseau temporaire → on garde statut 'pending' pour retry
      return undefined;
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
  // Retourne le statut ET les données du produit (réelles si online,
  // temporaires en cache local si offline) afin que l'appelant puisse
  // rafraîchir sa liste/UI immédiatement dans les deux cas.
  async creerProduit(
    payload: Omit<ProduitPending, 'id' | 'statut' | 'createdAt' | 'tempId'>,
  ): Promise<{ statut: 'online' | 'offline'; data: CachedProduit }> {
    if (this.estEnLigne()) {
      try {
        const timeout$ = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000),
        );
        const res: any = await Promise.race([
          firstValueFrom(this.http.post(`${environment.apiUrl}/produits`, payload)),
          timeout$,
        ]);
        const produit = { ...res?.data, tenantId: payload.tenantId };
        // Mise en cache immédiate pour cohérence avec le mode offline
        await this.offline.ajouterProduitCache(produit);
        return { statut: 'online', data: produit };
      } catch { /* bascule offline */ }
    }

    // Hors ligne (ou requête échouée) → on garde le produit en cache local
    // immédiatement visible, et en queue de synchronisation
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await this.offline.ajouterProduitPending({
      ...payload,
      tempId,
      createdAt: new Date().toISOString(),
      statut: 'pending',
    });
    const produitTemp: CachedProduit = {
      _id: tempId,
      tenantId: payload.tenantId,
      nom: payload.nom,
      prix: payload.prix,
      stock: payload.stock,
      seuilAlerte: payload.seuilAlerte,
      codeBarres: payload.codeBarres,
      categorie: payload.categorie,
    };
    await this.offline.ajouterProduitCache(produitTemp);
    await this.rafraichirCompteur();
    return { statut: 'offline', data: produitTemp };
  }

  // ─── Ajuster le stock d'un produit existant (réassort, online ou offline) ──
  // Met toujours à jour le cache local optimiste (stockActuel + quantite)
  // pour que l'UI patron reflète le changement immédiatement, même hors ligne.
  async ajusterStock(params: {
    tenantId: string;
    produitId: string;
    nom: string;
    stockActuel: number;
    quantite: number;
    type: 'entree' | 'sortie';
  }): Promise<'online' | 'offline'> {
    const { tenantId, produitId, nom, stockActuel, quantite, type } = params;
    const nouveauStock = type === 'entree' ? stockActuel + quantite : Math.max(0, stockActuel - quantite);

    // Produit lui-même pas encore synchronisé (id temporaire) : le serveur ne le
    // connaît pas encore, donc on corrige directement la fiche de création en
    // attente plutôt que de créer un ajustement de stock qui échouerait (404).
    if (produitId.startsWith('temp_')) {
      await this.offline.updateProduitStock(tenantId, produitId, nouveauStock);
      await this.offline.ajusterStockProduitPendingParTempId(produitId, nouveauStock);
      return 'offline';
    }

    if (this.estEnLigne()) {
      try {
        const timeout$ = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000),
        );
        await Promise.race([
          firstValueFrom(
            this.http.patch(`${environment.apiUrl}/produits/${produitId}/stock`, { quantite, type }),
          ),
          timeout$,
        ]);
        await this.offline.updateProduitStock(tenantId, produitId, nouveauStock);
        return 'online';
      } catch { /* bascule offline */ }
    }

    // Hors ligne, ou produit lui-même encore en attente de sync (id temporaire)
    // → on met à jour le cache tout de suite et on queue l'ajustement
    await this.offline.updateProduitStock(tenantId, produitId, nouveauStock);
    await this.offline.ajouterStockPending({
      tenantId,
      produitId,
      nom,
      quantite,
      type,
      createdAt: new Date().toISOString(),
      statut: 'pending',
    });
    await this.rafraichirCompteur();
    return 'offline';
  }
}
