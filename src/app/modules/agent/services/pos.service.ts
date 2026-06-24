import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SyncService } from '../../../core/services/sync.service';
import { OfflineService } from '../../../core/services/offline.service';

export interface CartItem {
  produit: any;
  quantite: number;
  prix: number;
}

export interface SaleTicket {
  numeroTicket: string;
  createdAt: string;
  items: CartItem[];
  total: number;
  modePaiement: string;
  modeCreation?: 'online' | 'offline';
}

@Injectable({ providedIn: 'root' })
export class PosService {
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  private lastTicketSubject = new BehaviorSubject<SaleTicket | null>(null);

  cart$ = this.cartSubject.asObservable();
  lastTicket$ = this.lastTicketSubject.asObservable();

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private sync: SyncService,
    private offline: OfflineService,
    private snack: MatSnackBar,
  ) {}

  get cartSnapshot(): CartItem[] {
    return this.cartSubject.value;
  }

  searchByBarcode(code: string): Observable<any> {
    return this.api.get(`produits/barcode/${encodeURIComponent(code)}`).pipe(
      map((res: any) => (res?.data ? res.data : res)),
      catchError((err) => throwError(() => err)),
    );
  }

  addToCart(produit: any): void {
    // Bloquer si stock = 0
    if ((produit?.stock ?? -1) === 0) {
      this.snack.open('Produit en rupture de stock', '✕', { duration: 3000, panelClass: 'snack-warn' });
      return;
    }

    const cart = [...this.cartSnapshot];
    const idx = cart.findIndex((i) => i.produit?._id === produit?._id);

    if (idx >= 0) {
      const enPanier = cart[idx].quantite;
      const stockDispo = produit?.stock ?? Infinity;
      // Bloquer si on dépasse le stock disponible
      if (enPanier >= stockDispo) {
        this.snack.open(`Stock max atteint (${stockDispo} unité${stockDispo > 1 ? 's' : ''})`, '✕', {
          duration: 3000, panelClass: 'snack-warn',
        });
        return;
      }
      cart[idx] = { ...cart[idx], quantite: enPanier + 1 };
    } else {
      cart.push({ produit, quantite: 1, prix: Number(produit?.prix || 0) });
    }
    this.cartSubject.next(cart);
  }

  decrementItem(produitId: string): void {
    const next = this.cartSnapshot
      .map((i) => (i.produit?._id === produitId ? { ...i, quantite: i.quantite - 1 } : i))
      .filter((i) => i.quantite > 0);
    this.cartSubject.next(next);
  }

  removeItem(produitId: string): void {
    this.cartSubject.next(this.cartSnapshot.filter((i) => i.produit?._id !== produitId));
  }

  clearCart(): void {
    this.cartSubject.next([]);
  }

  getTotal(): number {
    return this.cartSnapshot.reduce((sum, item) => sum + item.prix * item.quantite, 0);
  }

  // ─── Validation avec fallback offline ──────────────────────
  async validateSaleAsync(modePaiement = 'especes'): Promise<'online' | 'offline'> {
    const tenantId = this.auth.getTenantId() ?? '';
    const snapshot = this.cartSnapshot; // capture avant clearCart()
    const lignes = snapshot.map((item) => ({
      produitId: item.produit._id,
      nom: item.produit.nom,
      quantite: item.quantite,
      prixUnitaire: item.prix,
    }));

    const mode = await this.sync.creerVente({
      tenantId,
      lignes,
      montantTotal: this.getTotal(),
      modePaiement,
    });

    // Décrémenter le stock dans le cache Dexie local après chaque vente
    // → l'agent voit un stock à jour immédiatement (même en offline)
    try {
      for (const item of snapshot) {
        const cached = await this.offline.getProduitByBarcode(item.produit.codeBarres ?? '');
        const produit = cached ?? (await this.offline.getProduits(tenantId)).find(
          (p) => p._id === item.produit._id
        );
        if (produit) {
          const nouveauStock = Math.max(0, (produit.stock ?? 0) - item.quantite);
          await this.offline.updateProduitStock(tenantId, item.produit._id, nouveauStock);
        }
      }
    } catch { /* silencieux — le vrai stock sera rechargé depuis l'API au prochain ngOnInit */ }

    // Générer un ticket local dans tous les cas
    const now = new Date().toISOString();
    const numeroTicket =
      mode === 'offline' ? `TK-OFF-${Date.now()}` : `TK-${now.slice(0, 10).replace(/-/g, '')}-SYNC`;

    this.lastTicketSubject.next({
      numeroTicket,
      createdAt: now,
      items: snapshot,
      total: this.getTotal(),
      modePaiement,
      modeCreation: mode,
    });

    this.clearCart();
    return mode;
  }

  // Conservé pour compatibilité avec le code existant
  validateSale(modePaiement = 'especes'): Observable<any> {
    const produits = this.cartSnapshot.map((item) => ({
      produitId: item.produit._id,
      quantite: item.quantite,
    }));
    const payload = {
      produits,
      total: this.getTotal(),
      modePaiement,
      agentId: this.auth.getUser()?._id,
    };

    return this.api.post('ventes', payload).pipe(
      tap((res: any) => {
        const vente = res?.data;
        if (vente) {
          this.lastTicketSubject.next({
            numeroTicket: vente.numeroTicket,
            createdAt: vente.createdAt,
            items: this.cartSnapshot,
            total: vente.montantTotal ?? this.getTotal(),
            modePaiement: vente.modePaiement || modePaiement,
            modeCreation: 'online',
          });
          this.clearCart();
        }
      }),
    );
  }

  /** Correction du mode de paiement après impression (ticket déjà généré) */
  updateLastTicketMode(mode: string): void {
    const t = this.lastTicketSubject.value;
    if (t) this.lastTicketSubject.next({ ...t, modePaiement: mode });
  }

  printTicket(width: '58mm' | '80mm' = '58mm', shopName = 'SmartStock'): void {
    const ticket = this.lastTicketSubject.value;
    if (!ticket) return;

    const itemsHtml = ticket.items
      .map(
        (item) => `
        <tr>
          <td>${item.produit?.nom || 'Produit'}</td>
          <td style="text-align:center;">x${item.quantite}</td>
          <td style="text-align:right;">${(item.prix * item.quantite).toLocaleString('fr-FR')}</td>
        </tr>`,
      )
      .join('');

    const offlineBadge =
      ticket.modeCreation === 'offline'
        ? `<p style="color:#f59e0b;font-weight:bold;">⚠ Vente hors ligne — sera synchronisée</p>`
        : '';

    const html = `
      <html>
        <head>
          <title>Ticket ${ticket.numeroTicket}</title>
          <style>
            @page { margin: 0; }
            body { margin: 0; font-family: Arial, sans-serif; }
            .ticket { width: ${width}; margin: 0 auto; padding: 8px; font-size: 12px; }
            h2,h3,p { margin: 0; text-align: center; }
            .meta { margin: 6px 0; text-align: center; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            td { padding: 2px 0; vertical-align: top; }
            .total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-weight: 700; text-align: right; }
            .footer { margin-top: 8px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h2>${shopName}</h2>
            ${offlineBadge}
            <p>Ticket: ${ticket.numeroTicket}</p>
            <div class="meta">${new Date(ticket.createdAt).toLocaleString('fr-FR')}</div>
            <table>${itemsHtml}</table>
            <div class="total">Total: ${ticket.total.toLocaleString('fr-FR')} FCFA</div>
            <div class="footer">Merci pour votre achat</div>
          </div>
        </body>
      </html>
    `;

    // Stratégie anti-blocage Android :
    // window.open est bloqué par Chrome mobile si ce n'est pas déclenché
    // directement dans un handler de clic synchrone (ce qui est le cas ici).
    // On tente d'abord window.open, et on replie sur un iframe caché si
    // la popup est bloquée (printWindow === null).
    const printWindow = window.open('', '_blank', 'width=420,height=700');

    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 300);
      }, 250);
    } else {
      // Fallback : iframe caché injecté dans la page courante
      // Contourne le blocage popup des navigateurs mobiles
      const existingIframe = document.getElementById('print-iframe');
      if (existingIframe) existingIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 1000);
      }, 300);
    }
  }
}
