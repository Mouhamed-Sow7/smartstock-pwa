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
  stock: number;
  seuilAlerte?: number;
  codeBarres?: string;
  categorie?: string;
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
  lignes: { produitId: string; nom: string; quantite: number; prixUnitaire: number }[];
  montantTotal: number;
  modePaiement: string;
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

/** Ligne du panier persistée — survit aux fermetures d'app / rechargements forcés iOS */
export interface CartItemPersisted {
  id?: number;
  tenantId: string;
  produitId: string;
  nom: string;
  prix: number;
  quantite: number;
  stock: number;           // snapshot au moment d'ajout — limite max panier
  codeBarres?: string;
}

/** Produit créé hors-ligne — sera POSTé à /api/produits au retour en ligne */
export interface ProduitPending {
  id?: number;
  tenantId: string;
  data: any;               // champs bruts du produit (nom, prix, stock, categorie, etc.)
  createdAt: string;
  statut: 'pending' | 'synced' | 'error';
  errorMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineService extends Dexie {
  produits!: Table<CachedProduit, string>;
  agents!: Table<CachedAgent, string>;
  stats!: Table<CachedStats, string>;
  ventesPending!: Table<VentePending, number>;
  ventes!: Table<CachedVente, string>;
  cartItems!: Table<CartItemPersisted, number>;
  produitsPending!: Table<ProduitPending, number>;

  /** Émet chaque fois que le cache produits est mis à jour (sync ou décrément post-vente) */
  private _produitsUpdated$ = new Subject<void>();
  readonly produitsUpdated$ = this._produitsUpdated$.asObservable();

  constructor(private api: ApiService) {
    super('SmartStockDB');
    this.version(3).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
      ventes: '_id, tenantId, createdAt, numeroTicket',
      // v3 — nouvelles tables offline avancé
      cartItems: '++id, tenantId',
      produitsPending: '++id, tenantId, statut',
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
  async updateProduitStock(tenantId: string, produitId: string, nouveauStock: number): Promise<void> {
    await this.produits.where('_id').equals(produitId).modify({ stock: nouveauStock });
    this._produitsUpdated$.next();
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

  // ─── Panier persisté (survit aux fermetures iOS) ─────────────

  /** Sauvegarde l'état complet du panier en remplaçant toutes les lignes du tenant */
  async persisterPanier(tenantId: string, items: CartItemPersisted[]): Promise<void> {
    await this.cartItems.where('tenantId').equals(tenantId).delete();
    if (items.length > 0) {
      await this.cartItems.bulkAdd(items.map(i => ({ ...i, tenantId })));
    }
  }

  /** Charge le panier persisté (appelé dans pos.service.ts au démarrage) */
  async restaurerPanier(tenantId: string): Promise<CartItemPersisted[]> {
    return this.cartItems.where('tenantId').equals(tenantId).toArray();
  }

  /** Vide le panier persisté (après validation d'une vente) */
  async viderPanierPersiste(tenantId: string): Promise<void> {
    await this.cartItems.where('tenantId').equals(tenantId).delete();
  }

  // ─── Produits créés offline ───────────────────────────────────

  /** Sauvegarde un produit créé hors-ligne pour sync ultérieure */
  async ajouterProduitPending(produit: Omit<ProduitPending, 'id'>): Promise<number> {
    return this.produitsPending.add(produit);
  }

  async getProduitsPending(tenantId: string): Promise<ProduitPending[]> {
    return this.produitsPending
      .where('statut').equals('pending')
      .and(p => p.tenantId === tenantId)
      .toArray();
  }

  async marquerProduitSynced(id: number): Promise<void> {
    await this.produitsPending.update(id, { statut: 'synced' });
  }

  async marquerProduitError(id: number, message: string): Promise<void> {
    await this.produitsPending.update(id, { statut: 'error', errorMessage: message });
  }

  async compterProduitsPending(tenantId: string): Promise<number> {
    return this.produitsPending
      .where('statut').equals('pending')
      .and(p => p.tenantId === tenantId)
      .count();
  }

  async nettoyerProduitsSynced(): Promise<void> {
    await this.produitsPending.where('statut').equals('synced').delete();
  }
}
