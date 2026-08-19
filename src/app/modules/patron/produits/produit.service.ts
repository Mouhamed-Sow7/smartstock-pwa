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
  prixGros?: number;
  prixAchat?: number;
  stock: number;
  categorie: string;
  codeBarres?: string;
  seuilAlerte?: number;
  dateExpiration?: string | null;
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

  /**
   * Crée un produit. En ligne → API directe. Hors ligne (ou requête échouée) →
   * mis en cache localement + queue de synchronisation (SyncService), pour que
   * le patron voie le produit immédiatement et qu'il se synchronise seul au
   * retour de la connexion.
   */
  create(produit: Produit): Observable<any> {
    const tenantId = this.auth.getTenantId() ?? '';
    return from(
      this.sync.creerProduit({
        tenantId,
        nom: produit.nom,
        prix: produit.prix,
        prixGros: produit.prixGros,
        prixAchat: produit.prixAchat,
        stock: produit.stock,
        seuilAlerte: produit.seuilAlerte,
        codeBarres: produit.codeBarres,
        categorie: produit.categorie,
        dateExpiration: produit.dateExpiration,
      }),
    ).pipe(
      switchMap(({ statut, data }) =>
        of({ success: true, data, offline: statut === 'offline' }),
      ),
    );
  }

  update(id: string, produit: Produit): Observable<any> {
    return this.api.put(`produits/${id}`, produit);
  }

  /**
   * Ajuste le stock (réassort). En ligne → API directe + mise à jour cache.
   * Hors ligne (ou produit lui-même pas encore synchronisé) → mise à jour
   * optimiste du cache + queue de synchronisation.
   * `nom` et `stockActuel` sont nécessaires pour le calcul optimiste hors ligne.
   */
  updateStock(
    id: string,
    quantite: number,
    type: 'entree' | 'sortie',
    nom = '',
    stockActuel = 0,
  ): Observable<any> {
    const tenantId = this.auth.getTenantId() ?? '';
    return from(
      this.sync.ajusterStock({ tenantId, produitId: id, nom, stockActuel, quantite, type }),
    ).pipe(switchMap((statut) => of({ success: true, offline: statut === 'offline' })));
  }

  delete(id: string): Observable<any> {
    return this.api.delete(`produits/${id}`);
  }
}
