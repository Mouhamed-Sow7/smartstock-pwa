import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil, timeout, retry } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { PosService } from '../services/pos.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <div class="header">
        <div class="greeting">
          <mat-icon class="greeting-icon">waving_hand</mat-icon>
          <div>
            <div class="greeting-sub">Bonjour,</div>
            <div class="greeting-name">{{ prenom }}</div>
          </div>
        </div>
        <div class="header-date">{{ today }}</div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card accent">
          <div class="kpi-icon-wrap accent">
            <mat-icon>point_of_sale</mat-icon>
          </div>
          <div class="kpi-body">
            <div class="kpi-value">{{ jour.total | number: '1.0-0' }}</div>
            <div class="kpi-unit">FCFA</div>
            <div class="kpi-label">Ventes du jour</div>
          </div>
        </div>
        <div class="kpi-card warn" [class.has-alert]="alertes > 0">
          <div class="kpi-icon-wrap warn">
            <mat-icon>inventory_2</mat-icon>
          </div>
          <div class="kpi-body">
            <div class="kpi-value">{{ alertes }}</div>
            <div class="kpi-unit">produits</div>
            <div class="kpi-label">Stock bas</div>
          </div>
        </div>
      </div>

      <!-- Actions rapides -->
      <div class="section-title">Actions rapides</div>
      <div class="quick-actions">
        <a routerLink="/agent/scan" class="action-card">
          <div class="action-icon">
            <mat-icon>qr_code_scanner</mat-icon>
          </div>
          <div class="action-body">
            <div class="action-name">Scanner un produit</div>
            <div class="action-sub">Caméra ou saisie manuelle</div>
          </div>
          <mat-icon class="action-arrow">chevron_right</mat-icon>
        </a>
        <a routerLink="/agent/panier" class="action-card">
          <div class="action-icon cart">
            <mat-icon>shopping_cart</mat-icon>
          </div>
          <div class="action-body">
            <div class="action-name">Voir le panier</div>
            <div class="action-sub">{{ cartCount }} article(s) en attente</div>
          </div>
          <span class="cart-badge" *ngIf="cartCount > 0">{{ cartCount }}</span>
          <mat-icon class="action-arrow">chevron_right</mat-icon>
        </a>
        <a routerLink="/agent/ticket" class="action-card">
          <div class="action-icon ticket">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="action-body">
            <div class="action-name">Réimprimer ticket</div>
            <div class="action-sub">Dernier ticket généré</div>
          </div>
          <mat-icon class="action-arrow">chevron_right</mat-icon>
        </a>
      </div>

      <!-- Alertes stock -->
      <div class="stock-section" *ngIf="stockBas.length > 0">
        <div class="section-title" style="margin-top:0">
          <mat-icon style="font-size:15px;vertical-align:middle;color:var(--warning)"
            >warning</mat-icon
          >
          Alertes stock
        </div>
        <div class="stock-item" *ngFor="let p of stockBas | slice: 0 : 5">
          <span class="stock-nom">{{ p.nom }}</span>
          <span class="stock-qty" [class.critical]="p.stock <= 2">{{ p.stock }} restant(s)</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard {
        max-width: 600px;
        margin: 0 auto;
      }

      /* Header */
      .header {
        margin-bottom: 20px;
      }
      .greeting {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 4px;
      }
      .greeting-icon {
        color: var(--accent);
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
      .greeting-sub {
        color: var(--text-3);
        font-size: 12px;
      }
      .greeting-name {
        color: var(--text-1);
        font-size: 20px;
        font-weight: 700;
      }
      .header-date {
        color: var(--text-3);
        font-size: 12px;
        margin-top: 4px;
      }

      /* KPIs */
      .kpi-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 24px;
      }
      .kpi-card {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 16px;
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        backdrop-filter: blur(12px);
      }
      .kpi-card.has-alert {
        border-color: rgba(243, 156, 18, 0.3);
        background: rgba(243, 156, 18, 0.08);
      }
      .kpi-icon-wrap {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .kpi-icon-wrap.accent {
        background: var(--accent-lite);
      }
      .kpi-icon-wrap.accent mat-icon {
        color: var(--accent);
      }
      .kpi-icon-wrap.warn {
        background: rgba(243, 156, 18, 0.15);
      }
      .kpi-icon-wrap.warn mat-icon {
        color: var(--warning);
      }
      .kpi-value {
        color: var(--text-1);
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
      }
      .kpi-unit {
        color: var(--text-3);
        font-size: 10px;
        margin-top: 2px;
      }
      .kpi-label {
        color: var(--text-2);
        font-size: 11px;
        margin-top: 4px;
      }

      /* Section title */
      .section-title {
        color: var(--text-3);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Actions */
      .quick-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 24px;
      }
      .action-card {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 14px;
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--text-1);
        backdrop-filter: blur(12px);
        transition:
          border-color 0.2s,
          background 0.2s;
      }
      .action-card:hover {
        border-color: var(--accent);
        background: var(--accent-lite);
      }
      .action-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: var(--accent-lite);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .action-icon mat-icon {
        color: var(--accent);
      }
      .action-icon.cart {
        background: rgba(52, 152, 219, 0.15);
      }
      .action-icon.cart mat-icon {
        color: #3498db;
      }
      .action-icon.ticket {
        background: rgba(155, 89, 182, 0.15);
      }
      .action-icon.ticket mat-icon {
        color: #9b59b6;
      }
      .action-body {
        flex: 1;
      }
      .action-name {
        color: var(--text-1);
        font-size: 14px;
        font-weight: 600;
      }
      .action-sub {
        color: var(--text-3);
        font-size: 11px;
        margin-top: 2px;
      }
      .action-arrow {
        color: var(--text-3);
        font-size: 18px;
      }
      .cart-badge {
        background: #e17055;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Stock alertes */
      .stock-section {
        background: var(--navy-card);
        border: 1px solid rgba(243, 156, 18, 0.2);
        border-radius: 14px;
        padding: 14px;
        backdrop-filter: blur(12px);
      }
      .stock-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--navy-border);
        font-size: 13px;
      }
      .stock-item:last-child {
        border-bottom: none;
      }
      .stock-nom {
        color: var(--text-2);
      }
      .stock-qty {
        color: var(--warning);
        font-weight: 600;
        font-size: 12px;
      }
      .stock-qty.critical {
        color: var(--danger);
      }
    `,
  ],
})
export class AgentDashboardComponent implements OnInit, OnDestroy {
  jour = { total: 0 };
  alertes = 0;
  stockBas: any[] = [];
  cartCount = 0;
  prenom = 'Agent';
  today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private pos: PosService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    // L'agent est loggué via QR code — son nom vient du token JWT
    // On prend le premier mot du nom complet comme prénom
    if (user?.nom) this.prenom = user.nom.split(' ')[0];
    else if (user?.prenom) this.prenom = user.prenom;
    else this.prenom = user?.email?.split('@')[0] || 'Agent';

    this.chargerStats();

    this.pos.cart$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      this.cartCount = items.reduce((sum, i) => sum + i.quantite, 0);
      this.cdr.detectChanges();
    });
  }

  chargerStats(): void {
    forkJoin({
      stats: this.api.get('ventes/stats').pipe(
        timeout(15000),
        retry({ count: 3, delay: 4000 }),
        catchError((err) => {
          console.error('Stats agent:', err?.status, err?.error?.message || err?.message);
          return of(null);
        }),
      ),
      alertes: this.api.get('produits/alerte').pipe(
        timeout(15000),
        retry({ count: 2, delay: 3000 }),
        catchError(() => of(null)),
      ),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: any) => {
        if (result?.stats?.success) this.jour = result.stats.data?.jour || this.jour;
        if (result?.alertes?.success) {
          this.stockBas = result.alertes.data || [];
          this.alertes = this.stockBas.length;
        }
        this.cdr.detectChanges(); // Force le rendu même hors zone Angular
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
