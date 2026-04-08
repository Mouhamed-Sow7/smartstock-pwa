import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PosService, CartItem } from '../services/pos.service';
@Component({
  selector: 'app-panier',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <h1>Panier</h1>
      <p>Votre panier de vente</p>

      <div *ngIf="items.length === 0">Aucun article pour le moment.</div>

      <div class="item" *ngFor="let item of items">
        <div>
          <strong>{{ item.produit?.nom }}</strong>
          <div>{{ item.prix | number: '1.0-0' }} FCFA x {{ item.quantite }}</div>
        </div>
        <div class="actions">
          <button (click)="decrement(item)">-</button>
          <button (click)="remove(item)">Suppr</button>
        </div>
      </div>

      <div class="total">Total: {{ total | number: '1.0-0' }} FCFA</div>
      <button class="validate" (click)="validateSale()" [disabled]="items.length === 0 || isSaving">
        {{ isSaving ? 'Validation...' : 'Valider la vente' }}
      </button>
      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
    </div>
  `,
  styles: [
    `
      .page-container {
        padding: 16px;
      }
      .item {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
        padding: 10px;
        border: 1px solid #eee;
        border-radius: 8px;
      }
      .actions {
        display: flex;
        gap: 6px;
      }
      button {
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
      }
      .validate {
        background: #0984e3;
        color: white;
        margin-top: 12px;
      }
      .total {
        margin-top: 12px;
        font-weight: 700;
      }
      .error {
        color: #d63031;
      }
    `,
  ],
})
export class PanierComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  total = 0;
  isSaving = false;
  errorMessage = '';
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

  decrement(item: CartItem): void {
    this.pos.decrementItem(item.produit._id);
  }

  remove(item: CartItem): void {
    this.pos.removeItem(item.produit._id);
  }

  validateSale(): void {
    this.errorMessage = '';
    this.isSaving = true;
    this.pos
      .validateSale()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.router.navigate(['/agent/ticket']);
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = err?.error?.message || 'Impossible de valider la vente';
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
