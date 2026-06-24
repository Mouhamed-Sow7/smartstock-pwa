import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
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

@Injectable({ providedIn: 'root' })
export class OfflineService extends Dexie {
  produits!: Table<CachedProduit, string>;
  agents!: Table<CachedAgent, string>;
  stats!: Table<CachedStats, string>;
  ventesPending!: Table<VentePending, number>;
  ventes!: Table<CachedVente, string>;

  constructor(private api: ApiService) {
    super('SmartStockDB');
    this.version(2).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
      ventes: '_id, tenantId, createdAt, numeroTicket',
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
  }
  async getProduits(tenantId: string): Promise<CachedProduit[]> {
    return this.produits.where('tenantId').equals(tenantId).toArray();
  }
  async getProduitByBarcode(codeBarres: string): Promise<CachedProduit | undefined> {
    return this.produits.where('codeBarres').equals(codeBarres).first();
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
}
