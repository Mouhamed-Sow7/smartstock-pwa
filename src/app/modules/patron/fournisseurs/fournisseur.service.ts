import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

export interface Fournisseur {
  _id?: string;
  nom: string;
  telephone?: string;
  adresse?: string;
  notes?: string;
}

export interface LigneAchat {
  produitId?: string | null;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

export interface Achat {
  _id?: string;
  fournisseurId: string;
  fournisseurNom?: string;
  date: string;
  numeroFacture?: string;
  lignes: LigneAchat[];
  montantTotal?: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class FournisseurService {
  constructor(private api: ApiService) {}

  getFournisseurs() { return this.api.get('fournisseurs'); }
  createFournisseur(f: Partial<Fournisseur>) { return this.api.post('fournisseurs', f); }
  updateFournisseur(id: string, f: Partial<Fournisseur>) { return this.api.patch(`fournisseurs/${id}`, f); }
  deleteFournisseur(id: string) { return this.api.delete(`fournisseurs/${id}`); }

  getAchats(fournisseurId?: string) {
    return this.api.get(fournisseurId ? `achats?fournisseurId=${fournisseurId}` : 'achats');
  }
  createAchat(a: Partial<Achat>) { return this.api.post('achats', a); }
  deleteAchat(id: string) { return this.api.delete(`achats/${id}`); }
  dernierPrixAchat(produitId: string) { return this.api.get(`achats/dernier-prix/${produitId}`); }
}
