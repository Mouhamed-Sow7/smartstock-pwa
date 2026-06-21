import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { OfflineService } from '../../../core/services/offline.service';
import { AuthService } from '../../../core/services/auth.service';
import { SyncService } from '../../../core/services/sync.service';

export interface Produit {
  _id?: string;
  nom: string;
  prix: number;
  stock: number;
  categorie: string;
  codeBarres?: string;
  seuilAlerte?: number;
}

@Injectable({ providedIn: 'root' })
export class ProduitService {
  constructor(
    private api: ApiService,
    private offline: OfflineService,
    private auth: AuthService,
    private sync: SyncService,
  ) {}

  getAll(): Observable<any> {
    const tenantId = this.auth.getTenantId() ?? '';

    if (!this.sync.estEnLigne()) {
      // Hors ligne → retourne le cache
      return from(this.offline.getProduits(tenantId)).pipe(
        switchMap((cached) => of({ success: true, data: cached, fromCache: true })),
      );
    }

    // En ligne → appel API + mise en cache
    return this.api.get('produits').pipe(
      tap((res: any) => {
        if (res?.success && res?.data) {
          const produits = res.data.map((p: any) => ({ ...p, tenantId }));
          this.offline.cacheProduits(tenantId, produits);
        }
      }),
      catchError(() =>
        from(this.offline.getProduits(tenantId)).pipe(
          switchMap((cached) => of({ success: true, data: cached, fromCache: true })),
        ),
      ),
    );
  }

  getById(id: string): Observable<any> {
    return this.api.get(`produits/${id}`);
  }

  getByBarcode(code: string): Observable<any> {
    if (!this.sync.estEnLigne()) {
      return from(this.offline.getProduitByBarcode(code)).pipe(
        switchMap((p) =>
          p
            ? of({ success: true, data: p })
            : of({ success: false, message: 'Produit non trouvé dans le cache' }),
        ),
      );
    }
    return this.api.get(`produits/barcode/${encodeURIComponent(code)}`);
  }

  create(produit: Produit): Observable<any> {
    return this.api.post('produits', produit);
  }

  update(id: string, produit: Produit): Observable<any> {
    return this.api.put(`produits/${id}`, produit);
  }

  updateStock(id: string, quantite: number, type: 'entree' | 'sortie'): Observable<any> {
    return this.api.patch(`produits/${id}/stock`, { quantite, type });
  }

  delete(id: string): Observable<any> {
    return this.api.delete(`produits/${id}`);
  }
}
