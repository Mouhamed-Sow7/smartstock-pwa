import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { PosService } from '../services/pos.service';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="dashboard">
      <div class="header">
        <h1>Bonjour 👋</h1>
        <p>Vue rapide de votre activité de caisse</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card green">
          <mat-icon>point_of_sale</mat-icon>
          <div>
            <div class="value">{{ jour.total | number: '1.0-0' }} FCFA</div>
            <div class="label">Ventes du jour</div>
          </div>
        </div>
        <div class="kpi-card orange">
          <mat-icon>warning</mat-icon>
          <div>
            <div class="value">{{ alertes }}</div>
            <div class="label">Produits stock bas</div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <a routerLink="/agent/scan" class="action-card">
          <mat-icon>qr_code_scanner</mat-icon>
          <span>Scanner un produit</span>
        </a>
        <a routerLink="/agent/panier" class="action-card">
          <mat-icon>shopping_cart</mat-icon>
          <span>Voir le panier ({{ cartCount }})</span>
        </a>
        <a routerLink="/agent/ticket" class="action-card">
          <mat-icon>print</mat-icon>
          <span>Réimprimer ticket</span>
        </a>
      </div>

      <div class="stock-section" *ngIf="stockBas.length > 0">
        <h3>Alertes stock</h3>
        <div class="stock-item" *ngFor="let p of stockBas | slice: 0 : 5">
          <span>{{ p.nom }}</span>
          <strong>{{ p.stock }} restant(s)</strong>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard {
        max-width: 860px;
        margin: 0 auto;
      }
      .header h1 {
        margin-bottom: 4px;
        color: #1a1a2e;
      }
      .header p {
        color: #6c757d;
        margin-bottom: 16px;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .kpi-card {
        border-radius: 12px;
        color: #fff;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .kpi-card.green {
        background: #00b894;
      }
      .kpi-card.orange {
        background: #e17055;
      }
      .value {
        font-weight: 700;
        font-size: 18px;
      }
      .label {
        font-size: 12px;
        opacity: 0.9;
      }
      .quick-actions {
        margin-top: 16px;
        display: grid;
        gap: 10px;
      }
      .action-card {
        background: #fff;
        border: 1px solid #e9ecef;
        border-radius: 12px;
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #1a1a2e;
        text-decoration: none;
        font-weight: 600;
      }
      .action-card mat-icon {
        color: #00b894;
      }
      .stock-section {
        margin-top: 16px;
        background: #fff;
        border: 1px solid #e9ecef;
        border-radius: 12px;
        padding: 12px;
      }
      .stock-section h3 {
        font-size: 15px;
        margin-bottom: 8px;
      }
      .stock-item {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        padding: 8px 0;
        border-bottom: 1px solid #f1f3f4;
      }
      .stock-item:last-child {
        border-bottom: 0;
      }
    `,
  ],
})
export class AgentDashboardComponent implements OnInit, OnDestroy {
  jour = { total: 0 };
  alertes = 0;
  stockBas: any[] = [];
  cartCount = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private pos: PosService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      stats: this.api.get('ventes/stats').pipe(catchError(() => of(null))),
      alertes: this.api.get('produits/alerte').pipe(catchError(() => of(null))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: any) => {
        if (result?.stats?.success) {
          this.jour = result.stats.data?.jour || this.jour;
        }
        if (result?.alertes?.success) {
          this.stockBas = result.alertes.data || [];
          this.alertes = this.stockBas.length;
        }
      });

    this.pos.cart$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      this.cartCount = items.reduce((sum, i) => sum + i.quantite, 0);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
