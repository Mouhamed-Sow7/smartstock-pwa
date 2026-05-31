import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PosService, CartItem } from '../services/pos.service';

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
        <button class="validate-btn" (click)="validateSale()" [disabled]="isSaving">
          <mat-icon>{{ isSaving ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
          {{ isSaving ? 'Validation...' : 'Valider la vente' }}
        </button>
        <p class="offline-msg" *ngIf="offlineMsg">
          <mat-icon>wifi_off</mat-icon>
          {{ offlineMsg }}
        </p>
        <p class="error-msg" *ngIf="errorMessage">
          <mat-icon>error_outline</mat-icon>
          {{ errorMessage }}
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .panier {
        max-width: 600px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      /* Header */
      .page-header {
        margin-bottom: 4px;
      }
      .page-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .page-title mat-icon {
        color: var(--accent);
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
      .title-main {
        color: var(--text-1);
        font-size: 22px;
        font-weight: 700;
      }
      .title-sub {
        color: var(--text-3);
        font-size: 12px;
        margin-top: 2px;
      }

      /* Empty */
      .empty-state {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 16px;
        padding: 48px 24px;
        text-align: center;
        backdrop-filter: blur(12px);
      }
      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--text-3);
        margin-bottom: 12px;
      }
      .empty-title {
        color: var(--text-2);
        font-size: 16px;
        font-weight: 600;
      }
      .empty-sub {
        color: var(--text-3);
        font-size: 13px;
        margin-top: 4px;
      }

      /* Items */
      .items-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .item-card {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 14px;
        padding: 14px;
        backdrop-filter: blur(12px);
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-rows: auto auto;
        gap: 8px;
      }
      .item-nom {
        color: var(--text-1);
        font-size: 14px;
        font-weight: 600;
      }
      .item-prix {
        color: var(--text-3);
        font-size: 12px;
        margin-top: 2px;
      }
      .item-controls {
        display: flex;
        align-items: center;
        gap: 6px;
        grid-column: 1;
        grid-row: 2;
      }
      .item-subtotal {
        color: var(--accent);
        font-size: 15px;
        font-weight: 700;
        grid-column: 2;
        grid-row: 1 / 3;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
      .ctrl-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid var(--navy-border);
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        transition: background 0.2s;
      }
      .ctrl-btn mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      .ctrl-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .ctrl-btn.accent {
        background: var(--accent-lite);
        border-color: rgba(0, 184, 148, 0.3);
        color: var(--accent);
      }
      .ctrl-btn.danger {
        background: rgba(225, 112, 85, 0.1);
        border-color: rgba(225, 112, 85, 0.3);
        color: var(--danger);
      }
      .item-qty {
        color: var(--text-1);
        font-size: 15px;
        font-weight: 700;
        min-width: 24px;
        text-align: center;
      }

      /* Footer */
      .panier-footer {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 16px;
        padding: 16px;
        backdrop-filter: blur(12px);
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--navy-border);
      }
      .total-label {
        color: var(--text-2);
        font-size: 14px;
        font-weight: 600;
      }
      .total-value {
        color: var(--text-1);
        font-size: 22px;
        font-weight: 700;
      }
      .validate-btn {
        width: 100%;
        padding: 14px;
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .validate-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .validate-btn mat-icon {
        font-size: 20px;
      }
      .offline-msg {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--warning);
        font-size: 12px;
        margin-top: 10px;
      }
      .offline-msg mat-icon {
        font-size: 16px;
      }
      .error-msg {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--danger);
        font-size: 12px;
        margin-top: 10px;
      }
      .error-msg mat-icon {
        font-size: 16px;
      }
    `,
  ],
})
export class PanierComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  total = 0;
  isSaving = false;
  errorMessage = '';
  offlineMsg = '';
  private destroy$ = new Subject<void>();

  constructor(
    private pos: PosService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.pos.cart$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      this.items = items;
      this.total = this.pos.getTotal();
    });
  }

  increment(item: CartItem): void {
    this.pos.addToCart(item.produit);
  }

  decrement(item: CartItem): void {
    this.pos.decrementItem(item.produit._id);
  }

  remove(item: CartItem): void {
    this.pos.removeItem(item.produit._id);
  }

  validateSale(): void {
    this.errorMessage = '';
    this.offlineMsg = '';
    this.isSaving = true;
    this.pos
      .validateSaleAsync()
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
