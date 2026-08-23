import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Subject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface CachedProduit {
  _id: string;
  tenantId: string;
  nom: string;
  prix: number;
  prixGros?: number;
  stock: number;
  stockGros?: number;
  modeStock?: 'separe' | 'lie';
  uniteParGros?: number;
  seuilAlerte?: number;
  codeBarres?: string;
  categorie?: string;
  dateExpiration?: string | null;
  updatedAt?: string;
}

export interface CachedAgent {
  _id: string;
  tenantId: string;
  nom: string;
  email: string;
  actif: boolean;
  qrCode?: string;
}

export interface CachedStats {
  id: string;
  tenantId: string;
  data: any;
  cachedAt: number;
}

export interface VentePending {
  id?: number;
  tenantId: string;
  lignes: { produitId: string; nom: string; quantite: number; prixUnitaire: number; typeVente?: 'detail' | 'gros' }[];
  montantTotal: number;
  modePaiement: string;
  // Obligatoire uniquement quand modePaiement === 'credit' (vente à crédit) :
  // nom du client à qui la marchandise est prêtée, pour que le backend
  // crée/retrouve sa fiche et incrémente son soldeDu.
  clientNom?: string;
  createdAt: string;
  statut: 'pending' | 'synced' | 'error';
  errorMessage?: string;
}

export interface CachedVente {
  _id: string;
  tenantId: string;
  numeroTicket: string;
  agentNom: string;
  produits: any[];
  montantTotal: number;
  modePaiement: string;
  statut: string;
  createdAt: string;
}

export interface ProduitPending {
  id?: number;
  tempId?: string;
  tenantId: string;
  nom: string;
  prix: number;
  prixGros?: number;
  prixAchat?: number;
  stock: number;
  seuilAlerte?: number;
  codeBarres?: string;
  categorie?: string;
  dateExpiration?: string | null;
  statut: 'pending' | 'synced' | 'error';
  createdAt: string;
  errorMessage?: string;
}

export interface StockPending {
  id?: number;
  tenantId: string;
  produitId: string;
  nom: string;
  quantite: number;
  type: 'entree' | 'sortie';
  // Pool ciblé — 'stock' (détail) par défaut si absent, pour compat avec
  // les entrées en queue créées avant l'existence du stock gros.
  champ?: 'stock' | 'stockGros';
  statut: 'pending' | 'synced' | 'error';
  createdAt: string;
  errorMessage?: string;
}

export interface CartItemPersisted {
  cleLigne: string; // clé composite `${produitId}::${typeVente}` — clé primaire Dexie
  produitId: string;
  typeVente: 'detail' | 'gros';
  nom: string;
  prix: number;
  stock: number;
  codeBarres?: string;
  quantite: number;
  tenantId: string;
}
@Injectable({ providedIn: 'root' })
export class OfflineService extends Dexie {
  produits!: Table<CachedProduit, string>;
  agents!: Table<CachedAgent, string>;
  stats!: Table<CachedStats, string>;
  ventesPending!: Table<VentePending, number>;
  ventes!: Table<CachedVente, string>;
  produitsPending!: Table<ProduitPending, number>;
  stocksPending!: Table<StockPending, number>;
  panier!: Table<CartItemPersisted, string>;

  private _produitsUpdated$ = new Subject<void>();
  readonly produitsUpdated$ = this._produitsUpdated$.asObservable();

  constructor(private api: ApiService) {
    super('SmartStockDB');
    this.version(2).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
      ventes: '_id, tenantId, createdAt, numeroTicket',
    });
    // v3 : panier persisté + produits créés offline
    this.version(3).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
      ventes: '_id, tenantId, createdAt, numeroTicket',
      produitsPending: '++id, tenantId, statut, createdAt',
      panier: 'produitId, tenantId',
    });
    // v4 : réassorts (ajustements de stock) créés offline (patron)
    this.version(4).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
      ventes: '_id, tenantId, createdAt, numeroTicket',
      produitsPending: '++id, tenantId, statut, createdAt',
      stocksPending: '++id, tenantId, statut, createdAt, produitId',
      panier: 'produitId, tenantId',
    });
    // v5 : panier — clé composite (produitId + typeVente) pour permettre au
    // même produit d'apparaître en deux lignes distinctes du panier (une en
    // détail, une en gros) — la clé "produitId" seule écrasait la 2e ligne.
    //
    // BUG CORRIGÉ : IndexedDB/Dexie ne permet PAS de changer la clé primaire
    // (keyPath) d'une table existante en la redéclarant simplement dans
    // stores() — ça lève "UpgradeError: Not yet support for changing
    // primary key", qui faisait échouer l'OUVERTURE ENTIÈRE de la base
    // (DatabaseClosedError), pas juste le panier. Toute fonctionnalité
    // dépendant du cache offline (recherche produit par code-barres,
    // détection scan, création de produit) tombait alors en erreur réseau
    // ou devenait très lente (résolution du cache qui échouait puis
    // retentait). La seule façon supportée de changer une clé primaire est
    // de supprimer la table puis de la recréer dans une version ultérieure
    // — d'où la séparation en deux étapes ci-dessous.
    this.version(5).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
      ventes: '_id, tenantId, createdAt, numeroTicket',
      produitsPending: '++id, tenantId, statut, createdAt',
      stocksPending: '++id, tenantId, statut, createdAt, produitId',
      panier: null, // supprime l'ancienne table (clé primaire produitId)
    });
    // v6 : recrée panier avec la nouvelle clé primaire composite. Un panier
    // en cours (non encore validé) au moment de cette mise à jour est vidé
    // une fois — sans impact sur les ventes déjà synchronisées ni sur le
    // stock, il suffit de rescanner les articles.
    this.version(6).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
      ventes: '_id, tenantId, createdAt, numeroTicket',
      produitsPending: '++id, tenantId, statut, createdAt',
      stocksPending: '++id, tenantId, statut, createdAt, produitId',
      panier: 'cleLigne, tenantId, produitId',
    });
  }

  /**
   * Force le téléchargement de tous les produits depuis l'API distante
   * et écrase la table locale Dexie pour le tenant donné.
   * Retourne true si la mise à jour a eu lieu, false sinon.
   */
  async syncProduitsFromServer(tenantId: string): Promise<boolean> {
    try {
      const res: any = await firstValueFrom(this.api.get('produits'));
      if (res?.success && Array.isArray(res.data)) {
        const produits = res.data.map((p: any) => ({ ...p, tenantId }));
        await this.cacheProduits(tenantId, produits);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erreur lors de la synchronisation des produits :', err);
      return false;
    }
  }

  // ─── Produits ───────────────────────────────────────────────
  async cacheProduits(tenantId: string, produits: CachedProduit[]): Promise<void> {
    await this.produits.where('tenantId').equals(tenantId).delete();
    await this.produits.bulkPut(produits);
    this._produitsUpdated$.next();
  }
  async getProduits(tenantId: string): Promise<CachedProduit[]> {
    return this.produits.where('tenantId').equals(tenantId).toArray();
  }
  async getProduitByBarcode(codeBarres: string): Promise<CachedProduit | undefined> {
    return this.produits.where('codeBarres').equals(codeBarres).first();
  }

  /** Met à jour le stock d'un produit dans le cache Dexie local sans tout recharger */
  async updateProduitStock(tenantId: string, produitId: string, nouveauStock: number, champ: 'stock' | 'stockGros' = 'stock'): Promise<void> {
    await this.produits.where('_id').equals(produitId).modify({ [champ]: nouveauStock });
    this._produitsUpdated$.next();
  }

  /** Ajoute/remplace un seul produit dans le cache sans toucher aux autres (produit créé offline) */
  async ajouterProduitCache(produit: CachedProduit): Promise<void> {
    await this.produits.put(produit);
    this._produitsUpdated$.next();
  }

  /** Remplace l'entrée temporaire (créée offline, id `temp_...`) par le vrai produit renvoyé par le serveur */
  async remplacerProduitTemp(tempId: string, produitReel: CachedProduit): Promise<void> {
    await this.produits.delete(tempId);
    await this.produits.put(produitReel);
    this._produitsUpdated$.next();
  }

  /**
   * Remplace toute référence à un produit temp_ (produitId) par son vrai
   * _id serveur dans les ventes et réassorts DÉJÀ en attente de sync.
   *
   * Sans ça : une vente faite hors ligne juste après la création offline
   * d'un produit garde `produitId: "temp_xxx"` en mémoire pour toujours.
   * Même une fois le produit synchronisé (temp_xxx -> vrai _id Mongo), la
   * vente en attente n'était jamais mise à jour -> à chaque tentative de
   * sync, le backend recevait "temp_xxx" comme produitId, Mongoose levait
   * une CastError (ObjectId invalide) -> 500 permanent, retenté à l'infini
   * (le frontend traite les 500 comme des erreurs réseau temporaires, donc
   * ne s'arrête jamais) alors que le produit existe bien côté serveur.
   */
  async remapProduitIdDansPending(tempId: string, realId: string): Promise<void> {
    const ventesAMettreAJour = await this.ventesPending
      .filter((v) => v.statut === 'pending' && v.lignes.some((l) => l.produitId === tempId))
      .toArray();
    for (const v of ventesAMettreAJour) {
      const lignes = v.lignes.map((l) => (l.produitId === tempId ? { ...l, produitId: realId } : l));
      await this.ventesPending.update(v.id!, { lignes });
    }

    await this.stocksPending
      .where('produitId').equals(tempId)
      .modify({ produitId: realId });
  }

  // ─── Agents ─────────────────────────────────────────────────
  async cacheAgents(tenantId: string, agents: CachedAgent[]): Promise<void> {
    await this.agents.where('tenantId').equals(tenantId).delete();
    await this.agents.bulkPut(agents);
  }
  async getAgents(tenantId: string): Promise<CachedAgent[]> {
    return this.agents.where('tenantId').equals(tenantId).toArray();
  }

  // ─── Stats ──────────────────────────────────────────────────
  async cacheStats(tenantId: string, data: any): Promise<void> {
    await this.stats.put({ id: `stats_${tenantId}`, tenantId, data, cachedAt: Date.now() });
  }
  async getStats(tenantId: string): Promise<any | null> {
    const entry = await this.stats.get(`stats_${tenantId}`);
    return entry ? entry.data : null;
  }

  // ─── Ventes cache (pour rapports offline) ───────────────────
  async cacheVentes(tenantId: string, ventes: CachedVente[]): Promise<void> {
    await this.ventes.where('tenantId').equals(tenantId).delete();
    await this.ventes.bulkPut(ventes.map((v) => ({ ...v, tenantId })));
  }
  async getVentesCachees(tenantId: string, debut: string, fin: string): Promise<CachedVente[]> {
    return this.ventes
      .where('tenantId')
      .equals(tenantId)
      .and((v) => v.createdAt >= debut && v.createdAt <= fin)
      .toArray();
  }

  // ─── Ventes pending ─────────────────────────────────────────
  async ajouterVentePending(vente: Omit<VentePending, 'id'>): Promise<number> {
    return this.ventesPending.add(vente);
  }
  async getVentesPending(tenantId: string): Promise<VentePending[]> {
    return this.ventesPending
      .where('statut')
      .equals('pending')
      .and((v) => v.tenantId === tenantId)
      .toArray();
  }
  async marquerVenteSynced(id: number): Promise<void> {
    await this.ventesPending.update(id, { statut: 'synced' });
  }
  async marquerVenteError(id: number, message: string): Promise<void> {
    await this.ventesPending.update(id, { statut: 'error', errorMessage: message });
  }
  async compterVentesPending(tenantId: string): Promise<number> {
    return this.ventesPending
      .where('statut')
      .equals('pending')
      .and((v) => v.tenantId === tenantId)
      .count();
  }
  async nettoyerVentesSynced(): Promise<void> {
    await this.ventesPending.where('statut').equals('synced').delete();
  }

  // ─── Panier persisté ────────────────────────────────────────
  /** Sauvegarde un article dans le panier persisté (upsert par produitId) */
  async sauvegarderItemPanier(item: CartItemPersisted): Promise<void> {
    await this.panier.put(item);
  }
  /** Supprime un article du panier persisté */
  async supprimerItemPanier(produitId: string, typeVente: 'detail' | 'gros' = 'detail'): Promise<void> {
    await this.panier.delete(`${produitId}::${typeVente}`);
  }
  /** Récupère tous les articles du panier pour un tenant */
  async getItemsPanier(tenantId: string): Promise<CartItemPersisted[]> {
    return this.panier.where('tenantId').equals(tenantId).toArray();
  }
  /** Vide entièrement le panier persisté */
  async viderPanier(tenantId: string): Promise<void> {
    await this.panier.where('tenantId').equals(tenantId).delete();
  }

  // ─── Produits pending (créés offline) ───────────────────────
  async ajouterProduitPending(p: Omit<ProduitPending, 'id'>): Promise<number> {
    return this.produitsPending.add(p);
  }
  async getProduitsPending(tenantId: string): Promise<ProduitPending[]> {
    return this.produitsPending
      .where('statut').equals('pending')
      .and((p) => p.tenantId === tenantId)
      .toArray();
  }
  async marquerProduitSynced(id: number): Promise<void> {
    await this.produitsPending.update(id, { statut: 'synced' });
  }
  async marquerProduitError(id: number, msg: string): Promise<void> {
    await this.produitsPending.update(id, { statut: 'error', errorMessage: msg });
  }
  async compterProduitsPending(tenantId: string): Promise<number> {
    return this.produitsPending
      .where('statut').equals('pending')
      .and((p) => p.tenantId === tenantId)
      .count();
  }
  async nettoyerProduitsSynced(): Promise<void> {
    await this.produitsPending.where('statut').equals('synced').delete();
  }

  /** Ajuste le stock d'un produit encore en attente de sync (id temporaire temp_...) directement dans sa fiche pending */
  async ajusterStockProduitPendingParTempId(tempId: string, nouveauStock: number, champ: 'stock' | 'stockGros' = 'stock'): Promise<boolean> {
    const entree = await this.produitsPending.where('tempId').equals(tempId).first();
    if (!entree?.id) return false;
    await this.produitsPending.update(entree.id, { [champ]: nouveauStock } as any);
    return true;
  }

  // ─── Réassorts pending (ajustements stock offline, patron) ──
  async ajouterStockPending(s: Omit<StockPending, 'id'>): Promise<number> {
    return this.stocksPending.add(s);
  }
  async getStocksPending(tenantId: string): Promise<StockPending[]> {
    return this.stocksPending
      .where('statut').equals('pending')
      .and((s) => s.tenantId === tenantId)
      .toArray();
  }
  async marquerStockSynced(id: number): Promise<void> {
    await this.stocksPending.update(id, { statut: 'synced' });
  }
  async marquerStockError(id: number, msg: string): Promise<void> {
    await this.stocksPending.update(id, { statut: 'error', errorMessage: msg });
  }
  async compterStocksPending(tenantId: string): Promise<number> {
    return this.stocksPending
      .where('statut').equals('pending')
      .and((s) => s.tenantId === tenantId)
      .count();
  }
  async nettoyerStocksSynced(): Promise<void> {
    await this.stocksPending.where('statut').equals('synced').delete();
  }
}
