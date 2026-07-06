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
        const produit =
          cached ??
          (await this.offline.getProduits(tenantId)).find((p) => p._id === item.produit._id);
        if (produit) {
          const nouveauStock = Math.max(0, (produit.stock ?? 0) - item.quantite);
          await this.offline.updateProduitStock(tenantId, item.produit._id, nouveauStock);
        }
      }
    } catch {
      /* silencieux — le vrai stock sera rechargé depuis l'API au prochain ngOnInit */
    }

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
          <td style="text-align:right;">${(item.prix * item.quantite).toLocaleString('fr-FR')} F</td>
        </tr>`,
      )
      .join('');

    const modeLabel: Record<string, string> = {
      especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', free_money: 'Free Money'
    };

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Ticket ${ticket.numeroTicket}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: Arial, sans-serif;
        background: #f5f5f5;
        display: flex; flex-direction: column;
        align-items: center; min-height: 100vh;
        padding: 16px 16px env(safe-area-inset-bottom, 16px);
      }
      .ticket {
        background: #fff;
        border-radius: 12px;
        padding: 20px 16px;
        width: 100%;
        max-width: 340px;
        box-shadow: 0 4px 16px rgba(0,0,0,.1);
      }
      h2 { font-size: 18px; text-align: center; margin-bottom: 4px; }
      .meta { text-align: center; font-size: 11px; color: #666; margin-bottom: 12px; }
      .num { text-align: center; font-size: 12px; color: #00966e; font-weight: 700; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
      td { padding: 4px 2px; vertical-align: top; }
      td:last-child { text-align: right; white-space: nowrap; }
      .sep { border-top: 1px dashed #ccc; margin: 8px 0; }
      .total { font-size: 16px; font-weight: 700; text-align: right; color: #00966e; margin: 8px 0 4px; }
      .mode { font-size: 12px; color: #666; text-align: right; margin-bottom: 12px; }
      .offline { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px;
        padding: 6px 10px; font-size: 11px; color: #92400e; text-align: center; margin-bottom: 10px; }
      .footer { text-align: center; font-size: 11px; color: #999; margin-top: 8px; }
      .btn-print {
        display: block; width: 100%; max-width: 340px;
        margin: 16px auto 0;
        padding: 14px; background: #00966e; color: #fff;
        border: none; border-radius: 10px; font-size: 16px; font-weight: 700;
        cursor: pointer;
      }
      .btn-close {
        display: block; width: 100%; max-width: 340px;
        margin: 8px auto 0;
        padding: 12px; background: transparent; color: #555;
        border: 1px solid #ccc; border-radius: 10px; font-size: 15px;
        cursor: pointer;
      }
      @media print {
        body { background: #fff; padding: 0; }
        .ticket { box-shadow: none; border-radius: 0; max-width: ${width}; padding: 4px; }
        .btn-print, .btn-close { display: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <h2>${shopName}</h2>
      <div class="num">${ticket.numeroTicket}</div>
      <div class="meta">${new Date(ticket.createdAt).toLocaleString('fr-FR')}</div>
      ${ticket.modeCreation === 'offline' ? '<div class="offline">Vente hors ligne — sera synchronisée</div>' : ''}
      <table>${itemsHtml}</table>
      <div class="sep"></div>
      <div class="total">Total : ${ticket.total.toLocaleString('fr-FR')} FCFA</div>
      <div class="mode">${modeLabel[ticket.modePaiement] || ticket.modePaiement}</div>
      <div class="footer">Merci pour votre achat</div>
    </div>
    <button class="btn-print" onclick="window.print()">Imprimer</button>
    <button class="btn-close" onclick="window.close()">Fermer</button>
    <script>
      // Sur Android, window.print() peut ne rien faire — on affiche au moins le ticket
      // L'utilisateur peut faire une capture d'écran ou partager depuis le navigateur
      document.querySelector('.btn-print').addEventListener('click', function() {
        if (typeof window.print === 'function') {
          window.print();
        }
      });
    </script>
  </body>
</html>`;

    // Ouvrir dans un nouvel onglet — fonctionne sur iOS Safari et Android Chrome
    // depuis un handler de clic synchrone (pas de blocage popup)
    const newWin = window.open('', '_blank');
    if (newWin) {
      newWin.document.write(html);
      newWin.document.close();
      return;
    }

    // Fallback si popup bloquée (PWA standalone) : naviguer vers une data URL
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
