import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PosService, CartItem } from '../services/pos.service';

type ModePaiement = 'especes' | 'wave' | 'orange_money' | 'free_money';

@Component({
  selector: 'app-panier',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="panier">
      <!-- Header -->
      <div class="page-header">
        <div class="page-title">
          <mat-icon>shopping_cart</mat-icon>
          <div>
            <div class="title-main">Panier</div>
            <div class="title-sub">{{ items.length }} article(s)</div>
          </div>
        </div>
      </div>

      <!-- Panier vide -->
      <div class="empty-state" *ngIf="items.length === 0">
        <mat-icon>remove_shopping_cart</mat-icon>
        <div class="empty-title">Panier vide</div>
        <div class="empty-sub">Scannez un produit pour commencer</div>
      </div>

      <!-- Liste articles -->
      <div class="items-list" *ngIf="items.length > 0">
        <div class="item-card" *ngFor="let item of items">
          <div class="item-info">
            <div class="item-nom">{{ item.produit?.nom }}</div>
            <div class="item-prix">{{ item.prix | number: '1.0-0' }} FCFA / unité</div>
          </div>
          <div class="item-controls">
            <button class="ctrl-btn" (click)="decrement(item)">
              <mat-icon>remove</mat-icon>
            </button>
            <span class="item-qty">{{ item.quantite }}</span>
            <button class="ctrl-btn accent" (click)="increment(item)">
              <mat-icon>add</mat-icon>
            </button>
            <button class="ctrl-btn danger" (click)="remove(item)">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
          <div class="item-subtotal">{{ item.prix * item.quantite | number: '1.0-0' }} FCFA</div>
        </div>
      </div>

      <!-- Footer total + validation -->
      <div class="panier-footer" *ngIf="items.length > 0">
        <div class="total-row">
          <span class="total-label">Total</span>
          <span class="total-value">{{ total | number: '1.0-0' }} FCFA</span>
        </div>

        <!-- Sélecteur mode paiement -->
        <div class="paiement-section">
          <div class="paiement-label">Mode de paiement</div>
          <div class="paiement-grid">
            <button
              *ngFor="let m of modes"
              class="mode-btn"
              [class.selected]="modePaiement === m.value"
              (click)="modePaiement = m.value"
            >
              <span class="mode-logo" [innerHTML]="m.svg"></span>
              <span class="mode-name">{{ m.label }}</span>
              <mat-icon class="mode-check" *ngIf="modePaiement === m.value">check_circle</mat-icon>
            </button>
          </div>
        </div>

        <button class="validate-btn" (click)="validateSale()" [disabled]="isSaving">
          <mat-icon>{{ isSaving ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
          {{ isSaving ? 'Validation...' : 'Valider — ' + modeLabel }}
        </button>
        <p class="offline-msg" *ngIf="offlineMsg">
          <mat-icon>wifi_off</mat-icon> {{ offlineMsg }}
        </p>
        <p class="error-msg" *ngIf="errorMessage">
          <mat-icon>error_outline</mat-icon> {{ errorMessage }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .panier { max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

    .page-header { margin-bottom: 4px; }
    .page-title { display: flex; align-items: center; gap: 12px; }
    .page-title mat-icon { color: var(--accent); font-size: 28px; width: 28px; height: 28px; }
    .title-main { color: var(--text-1); font-size: 22px; font-weight: 700; }
    .title-sub { color: var(--text-3); font-size: 12px; margin-top: 2px; }

    .empty-state {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 16px; padding: 48px 24px; text-align: center; backdrop-filter: blur(12px);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--text-3); margin-bottom: 12px; }
    .empty-title { color: var(--text-2); font-size: 16px; font-weight: 600; }
    .empty-sub { color: var(--text-3); font-size: 13px; margin-top: 4px; }

    .items-list { display: flex; flex-direction: column; gap: 8px; }
    .item-card {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 14px; padding: 14px; backdrop-filter: blur(12px);
      display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; gap: 8px;
    }
    .item-nom { color: var(--text-1); font-size: 14px; font-weight: 600; }
    .item-prix { color: var(--text-3); font-size: 12px; margin-top: 2px; }
    .item-controls { display: flex; align-items: center; gap: 6px; grid-column: 1; grid-row: 2; }
    .item-subtotal {
      color: var(--accent); font-size: 15px; font-weight: 700;
      grid-column: 2; grid-row: 1 / 3; display: flex; align-items: center; justify-content: flex-end;
    }
    .ctrl-btn {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--navy-border);
      background: rgba(255,255,255,.06); color: var(--text-2);
      display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: background .2s;
    }
    .ctrl-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .ctrl-btn:hover { background: rgba(255,255,255,.12); }
    .ctrl-btn.accent { background: var(--accent-lite); border-color: rgba(0,184,148,.3); color: var(--accent); }
    .ctrl-btn.danger { background: rgba(225,112,85,.1); border-color: rgba(225,112,85,.3); color: var(--danger); }
    .item-qty { color: var(--text-1); font-size: 15px; font-weight: 700; min-width: 24px; text-align: center; }

    /* Footer */
    .panier-footer {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 16px; padding: 16px; backdrop-filter: blur(12px);
    }
    .total-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--navy-border);
    }
    .total-label { color: var(--text-2); font-size: 14px; font-weight: 600; }
    .total-value { color: var(--text-1); font-size: 22px; font-weight: 700; }

    /* Mode paiement */
    .paiement-section { margin-bottom: 16px; }
    .paiement-label { color: var(--text-3); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; }
    .paiement-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .mode-btn {
      position: relative;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 12px 8px 10px; border-radius: 12px; cursor: pointer;
      border: 1.5px solid var(--navy-border);
      background: rgba(255,255,255,.03);
      color: var(--text-2); transition: all .15s;
    }
    .mode-btn:hover { background: rgba(255,255,255,.07); }
    .mode-btn.selected {
      border-color: var(--accent);
      background: var(--accent-lite);
    }
    .mode-logo { display: flex; align-items: center; justify-content: center; }
    .mode-logo svg { width: 44px; height: 32px; border-radius: 6px; }
    .mode-name { font-size: 12px; font-weight: 600; }
    .mode-check {
      position: absolute; top: 6px; right: 6px;
      font-size: 14px; width: 14px; height: 14px;
      color: var(--accent);
    }

    .validate-btn {
      width: 100%; padding: 14px; background: var(--accent); color: #fff;
      border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      cursor: pointer; transition: opacity .2s;
    }
    .validate-btn:disabled { opacity: .6; cursor: not-allowed; }
    .validate-btn mat-icon { font-size: 20px; }
    .offline-msg { display: flex; align-items: center; gap: 6px; color: var(--warning); font-size: 12px; margin-top: 10px; }
    .error-msg { display: flex; align-items: center; gap: 6px; color: var(--danger); font-size: 12px; margin-top: 10px; }
    .offline-msg mat-icon, .error-msg mat-icon { font-size: 16px; }
  `],
})
export class PanierComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  total = 0;
  isSaving = false;
  errorMessage = '';
  offlineMsg = '';
  modePaiement: ModePaiement = 'especes';
  private destroy$ = new Subject<void>();

  private readonly _rawModes: { value: ModePaiement; label: string; svg: string }[] = [
    {
      value: 'especes', label: 'Espèces',
      svg: `<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="46" height="30" rx="4" fill="#166534" stroke="#4ade80" stroke-width="1.5"/>
        <ellipse cx="24" cy="16" rx="7" ry="7" fill="#4ade80" opacity=".25"/>
        <text x="24" y="21" text-anchor="middle" fill="#4ade80" font-size="11" font-weight="bold" font-family="sans-serif">FCFA</text>
        <rect x="4" y="4" width="7" height="5" rx="1" fill="#4ade80" opacity=".4"/>
        <rect x="37" y="23" width="7" height="5" rx="1" fill="#4ade80" opacity=".4"/>
      </svg>`
    },
    {
      value: 'wave', label: 'Wave',
      svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="10" fill="#5BC8F5"/>
        <!-- Corps -->
        <ellipse cx="24" cy="30" rx="10" ry="12" fill="#1a1a1a"/>
        <!-- Ventre blanc -->
        <ellipse cx="24" cy="32" rx="6" ry="8" fill="white"/>
        <!-- Tête -->
        <ellipse cx="24" cy="17" rx="8" ry="8" fill="#1a1a1a"/>
        <!-- Yeux -->
        <circle cx="21" cy="15" r="1.5" fill="white"/>
        <circle cx="27" cy="15" r="1.5" fill="white"/>
        <!-- Bec -->
        <ellipse cx="24" cy="19.5" rx="2.5" ry="1.5" fill="#F5A623"/>
        <!-- Bras gauche levé -->
        <ellipse cx="13" cy="22" rx="3" ry="6" fill="#1a1a1a" transform="rotate(-40 13 22)"/>
        <!-- Bras droit -->
        <ellipse cx="35" cy="26" rx="3" ry="5" fill="#1a1a1a" transform="rotate(15 35 26)"/>
        <!-- Pattes -->
        <ellipse cx="20" cy="43" rx="4" ry="2.5" fill="#F5A623"/>
        <ellipse cx="28" cy="43" rx="4" ry="2.5" fill="#F5A623"/>
        <!-- Texte wave -->
        <text x="24" y="52" text-anchor="middle" fill="white" font-size="7" font-weight="bold" font-family="sans-serif">wave</text>
      </svg>`
    },
    {
      value: 'orange_money', label: 'Orange Money',
      svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="10" fill="white"/>
        <!-- Flèche noire ↗ -->
        <path d="M10 32 L28 10 L36 10 L36 18 L16 38 Z" fill="#1a1a1a"/>
        <polygon points="26,8 38,8 38,20" fill="#1a1a1a"/>
        <!-- Flèche orange ↙ -->
        <path d="M38 16 L20 38 L12 38 L12 30 L32 10 Z" fill="#FF6B00" opacity="0"/>
        <path d="M22 10 L38 28 L30 38 L12 22 Z" fill="none"/>
        <!-- Version simplifiée : deux flèches propres -->
        <g transform="translate(4,4)">
          <!-- Flèche noire haut-droite -->
          <path d="M4 28 L20 8 L28 8 L28 16 L14 32 Z" fill="#1a1a1a"/>
          <path d="M18 6 L30 6 L30 18 L26 14 L14 26 L10 22 L22 10 Z" fill="#1a1a1a"/>
          <!-- Flèche orange bas-gauche -->
          <path d="M36 12 L20 32 L12 32 L12 24 L26 8 Z" fill="none"/>
          <path d="M22 34 L10 34 L10 22 L14 26 L26 14 L30 18 L18 30 Z" fill="#FF6B00"/>
        </g>
      </svg>`
    },
    {
      value: 'free_money', label: 'Free Money',
      svg: `<svg viewBox="0 0 80 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="48" rx="10" fill="white"/>
        <!-- "free" en rouge italique -->
        <text x="40" y="24" text-anchor="middle" fill="#E30613" font-size="18" font-weight="bold" font-style="italic" font-family="Georgia,serif">free</text>
        <!-- Trait rouge souligné -->
        <line x1="12" y1="29" x2="68" y2="29" stroke="#E30613" stroke-width="2.5"/>
        <!-- "MONEY" en gris foncé -->
        <text x="40" y="42" text-anchor="middle" fill="#333333" font-size="11" font-weight="bold" font-family="Arial,sans-serif" letter-spacing="2">MONEY</text>
      </svg>`
    },
  ];

  get modeLabel(): string {
    return this._rawModes.find(m => m.value === this.modePaiement)?.label ?? 'Espèces';
  }

  readonly modes: { value: ModePaiement; label: string; svg: SafeHtml }[];
  constructor(private pos: PosService, private router: Router, sanitizer: DomSanitizer) {
    this.modes = this._rawModes.map(m => ({ ...m, svg: sanitizer.bypassSecurityTrustHtml(m.svg) }));
  }

  ngOnInit(): void {
    this.pos.cart$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      this.items = items;
      this.total = this.pos.getTotal();
    });
  }

  increment(item: CartItem): void { this.pos.addToCart(item.produit); }
  decrement(item: CartItem): void { this.pos.decrementItem(item.produit._id); }
  remove(item: CartItem): void    { this.pos.removeItem(item.produit._id); }

  validateSale(): void {
    this.errorMessage = '';
    this.offlineMsg = '';
    this.isSaving = true;
    this.pos.validateSaleAsync(this.modePaiement)
      .then((mode) => {
        this.isSaving = false;
        if (mode === 'offline') {
          this.offlineMsg = 'Vente sauvegardée hors ligne — synchronisation automatique';
          setTimeout(() => this.router.navigate(['/agent/ticket']), 1800);
        } else {
          this.router.navigate(['/agent/ticket']);
        }
      })
      .catch((err) => {
        this.isSaving = false;
        this.errorMessage = err?.message || 'Impossible de valider la vente';
      });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
