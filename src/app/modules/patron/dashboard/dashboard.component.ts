import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  template: `
    <div class="dashboard">
      <div class="page-header">
        <h1>Tableau de bord</h1>
        <p>{{ today }}</p>
      </div>

      <!-- KPIs revenus -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>today</mat-icon></div>
          <div class="kpi-content">
            <div class="kpi-value">{{ stats?.jour?.total | number: '1.0-0' }} FCFA</div>
            <div class="kpi-label">Aujourd'hui</div>
            <div class="kpi-sub">{{ stats?.jour?.ventes }} vente(s)</div>
          </div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>date_range</mat-icon></div>
          <div class="kpi-content">
            <div class="kpi-value">{{ stats?.semaine?.total | number: '1.0-0' }} FCFA</div>
            <div class="kpi-label">Cette semaine</div>
            <div class="kpi-sub">{{ stats?.semaine?.ventes }} vente(s)</div>
          </div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>calendar_month</mat-icon></div>
          <div class="kpi-content">
            <div class="kpi-value">{{ stats?.mois?.total | number: '1.0-0' }} FCFA</div>
            <div class="kpi-label">Ce mois</div>
            <div class="kpi-sub">{{ stats?.mois?.ventes }} vente(s)</div>
          </div>
        </div>
        <div class="kpi-card orange">
          <div class="kpi-icon"><mat-icon>bar_chart</mat-icon></div>
          <div class="kpi-content">
            <div class="kpi-value">{{ stats?.annee?.total | number: '1.0-0' }} FCFA</div>
            <div class="kpi-label">Cette année</div>
            <div class="kpi-sub">{{ stats?.annee?.ventes }} vente(s)</div>
          </div>
        </div>
      </div>

      <!-- Raccourcis -->
      <div class="shortcuts">
        <h2>Accès rapide</h2>
        <div class="shortcut-grid">
          <a class="shortcut-card" routerLink="/patron/produits">
            <mat-icon>inventory_2</mat-icon>
            <span>Produits</span>
          </a>
          <a class="shortcut-card" routerLink="/patron/agents">
            <mat-icon>badge</mat-icon>
            <span>Agents</span>
          </a>
          <a class="shortcut-card" routerLink="/patron/ventes">
            <mat-icon>receipt_long</mat-icon>
            <span>Ventes</span>
          </a>
          <a class="shortcut-card alert" routerLink="/patron/produits">
            <mat-icon>warning</mat-icon>
            <span>Stock bas ({{ alertes }})</span>
          </a>
        </div>
      </div>

      <!-- Méthodes paiement -->
      <div class="paiements-section" *ngIf="stats.paiements?.length">
        <h2>Méthodes de paiement</h2>
        <div class="paiement-list">
          <div class="paiement-item" *ngFor="let p of stats.paiements">
            <div class="paiement-name">{{ p._id | titlecase }}</div>
            <div class="paiement-bar-wrap">
              <div class="paiement-bar" [style.width.%]="getPourcentage(p.count)"></div>
            </div>
            <div class="paiement-count">{{ p.count }}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard {
        max-width: 800px;
        margin: 0 auto;
      }
      .page-header h1 {
        font-size: 22px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #1a1a2e;
      }
      .page-header p {
        color: #6c757d;
        font-size: 13px;
        margin: 0 0 24px;
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 24px;
      }
      .kpi-card {
        border-radius: 12px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: white;
      }
      .kpi-card.green {
        background: #00b894;
      }
      .kpi-card.blue {
        background: #0984e3;
      }
      .kpi-card.purple {
        background: #6c5ce7;
      }
      .kpi-card.orange {
        background: #e17055;
      }
      .kpi-icon mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        opacity: 0.85;
      }
      .kpi-value {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
      }
      .kpi-label {
        font-size: 11px;
        opacity: 0.85;
        margin-top: 2px;
      }
      .kpi-sub {
        font-size: 11px;
        opacity: 0.7;
      }

      .shortcuts h2,
      .paiements-section h2 {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 12px;
        color: #1a1a2e;
      }
      .shortcut-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 24px;
      }
      .shortcut-card {
        background: white;
        border-radius: 12px;
        padding: 16px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: #1a1a2e;
        font-size: 12px;
        font-weight: 500;
        border: 1px solid #e9ecef;
        transition: box-shadow 0.2s;
      }
      .shortcut-card mat-icon {
        color: #00b894;
        font-size: 24px;
      }
      .shortcut-card.alert mat-icon {
        color: #e17055;
      }
      .shortcut-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      .paiement-list {
        background: white;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #e9ecef;
      }
      .paiement-item {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .paiement-item:last-child {
        margin-bottom: 0;
      }
      .paiement-name {
        width: 100px;
        font-size: 13px;
        font-weight: 500;
        color: #1a1a2e;
      }
      .paiement-bar-wrap {
        flex: 1;
        background: #f1f3f4;
        border-radius: 4px;
        height: 8px;
      }
      .paiement-bar {
        background: #00b894;
        height: 8px;
        border-radius: 4px;
        min-width: 4px;
        transition: width 0.5s;
      }
      .paiement-count {
        font-size: 13px;
        color: #6c757d;
        width: 30px;
        text-align: right;
      }

      @media (max-width: 480px) {
        .shortcut-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  stats: any = {
    jour: { total: 0, ventes: 0 },
    semaine: { total: 0, ventes: 0 },
    mois: { total: 0, ventes: 0 },
    annee: { total: 0, ventes: 0 },
    paiements: [],
  };
  alertes = 0;
  totalVentes = 0;
  private destroy$ = new Subject<void>();

  constructor(private api: ApiService) {}

  ngOnInit() {
    forkJoin<any>({
      stats: this.api.get('ventes/stats').pipe(catchError(() => of(null))),
      alertes: this.api.get('produits/alerte').pipe(catchError(() => of(null))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: any) => {
        const { stats, alertes } = result || {};
        if (stats?.success) {
          this.stats = {
            ...this.stats,
            ...stats.data,
          };
          this.totalVentes = this.stats.paiements?.reduce((s: number, p: any) => s + p.count, 0) || 1;
        }
        if (alertes?.success) {
          this.alertes = alertes.data?.length || 0;
        }
      });
  }

  getPourcentage(count: number): number {
    return Math.round((count / this.totalVentes) * 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
