import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

export interface Produit {
  _id?: string;
  nom: string;
  prix: number;
  stock: number;
  categorie: string;
  codeBarres?: string;
  seuilAlerte?: number;
}

export interface ProduitListResponse {
  success: boolean;
  data: Produit[];
  message?: string;
}

export interface ProduitResponse {
  success: boolean;
  data: Produit;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProduitService {
  constructor(private api: ApiService) {}

  getAll(): Observable<any> {
    return this.api.get('produits');
  }

  getById(id: string): Observable<any> {
    return this.api.get(`produits/${id}`);
  }

  getByBarcode(code: string): Observable<any> {
    return this.api.get(`produits/barcode/${encodeURIComponent(code)}`);
  }

  create(produit: Produit): Observable<any> {
    return this.api.post('produits', produit);
  }

  update(id: string, produit: Produit): Observable<any> {
    return this.api.put(`produits/${id}`, produit);
  }

  delete(id: string): Observable<any> {
    return this.api.delete(`produits/${id}`);
  }
}
