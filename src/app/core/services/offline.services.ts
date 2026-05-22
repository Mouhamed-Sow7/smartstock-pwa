import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

// ─── Interfaces ───────────────────────────────────────────────
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
  id: string; // "stats_<tenantId>"
  tenantId: string;
  data: any;
  cachedAt: number; // timestamp
}

export interface VentePending {
  id?: number; // auto-increment Dexie
  tenantId: string;
  lignes: { produitId: string; nom: string; quantite: number; prixUnitaire: number }[];
  montantTotal: number;
  modePaiement: string;
  createdAt: string;
  statut: 'pending' | 'synced' | 'error';
  errorMessage?: string;
}

// ─── Base Dexie ───────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class OfflineService extends Dexie {
  produits!: Table<CachedProduit, string>;
  agents!: Table<CachedAgent, string>;
  stats!: Table<CachedStats, string>;
  ventesPending!: Table<VentePending, number>;

  constructor() {
    super('SmartStockDB');

    this.version(1).stores({
      produits: '_id, tenantId, nom, codeBarres',
      agents: '_id, tenantId, nom',
      stats: 'id, tenantId',
      ventesPending: '++id, tenantId, statut, createdAt',
    });
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
    await this.stats.put({
      id: `stats_${tenantId}`,
      tenantId,
      data,
      cachedAt: Date.now(),
    });
  }

  async getStats(tenantId: string): Promise<any | null> {
    const entry = await this.stats.get(`stats_${tenantId}`);
    return entry ? entry.data : null;
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
