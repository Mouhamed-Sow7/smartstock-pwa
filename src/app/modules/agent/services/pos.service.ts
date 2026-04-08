import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

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
    const cart = [...this.cartSnapshot];
    const idx = cart.findIndex((i) => i.produit?._id === produit?._id);
    if (idx >= 0) {
      cart[idx] = { ...cart[idx], quantite: cart[idx].quantite + 1 };
    } else {
      cart.push({
        produit,
        quantite: 1,
        prix: Number(produit?.prix || 0),
      });
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
          });
          this.clearCart();
        }
      }),
    );
  }

  printTicket(width: '58mm' | '80mm' = '58mm', shopName = 'SmartStock'): void {
    const ticket = this.lastTicketSubject.value;
    if (!ticket) return;

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) return;

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

    printWindow.document.write(`
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
        <body onload="window.print(); setTimeout(() => window.close(), 150);">
          <div class="ticket">
            <h2>${shopName}</h2>
            <p>Ticket: ${ticket.numeroTicket}</p>
            <div class="meta">${new Date(ticket.createdAt).toLocaleString('fr-FR')}</div>
            <table>${itemsHtml}</table>
            <div class="total">Total: ${ticket.total.toLocaleString('fr-FR')} FCFA</div>
            <div class="footer">Merci pour votre achat</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}
