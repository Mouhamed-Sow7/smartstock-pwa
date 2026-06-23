import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil, timeout, retry } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="dashboard">

      <!-- Greeting -->
      <div class="greeting-block">
        <div class="greeting-row">
          <span class="hand">👋</span>
          <div>
            <div class="greeting-sub">Bonjour,</div>
            <div class="greeting-name">{{ nomPatron }}</div>
          </div>
        </div>
        <div class="greeting-date">{{ today }}</div>
      </div>

      <!-- KPI Cards glass -->
      <div class="kpi-grid">
        <div class="kpi-card" style="--glow: #00b894; --glow2: #00cec9;">
          <div class="kpi-icon-wrap">
            <mat-icon>today</mat-icon>
          </div>
          <div class="kpi-body">
            <div class="kpi-value">{{ stats?.jour?.total | number:'1.0-0' }}</div>
            <div class="kpi-unit">FCFA</div>
            <div class="kpi-label">Aujourd'hui</div>
            <div class="kpi-sub">{{ stats?.jour?.ventes ?? 0 }} vente(s)</div>
          </div>
        </div>

        <div class="kpi-card" style="--glow: #00cec9; --glow2: #55efc4;">
          <div class="kpi-icon-wrap">
            <mat-icon>trending_up</mat-icon>
          </div>
          <div class="kpi-body">
            <div class="kpi-value">{{ stats?.mois?.marge | number:'1.0-0' }}</div>
            <div class="kpi-unit">FCFA</div>
            <div class="kpi-label">Marge du mois</div>
            <div class="kpi-sub">{{ margePctMois }}% de marge</div>
          </div>
        </div>

        <div class="kpi-card" style="--glow: #0984e3; --glow2: #74b9ff;">
          <div class="kpi-icon-wrap">
            <mat-icon>date_range</mat-icon>
          </div>
          <div class="kpi-body">
            <div class="kpi-value">{{ stats?.semaine?.total | number:'1.0-0' }}</div>
            <div class="kpi-unit">FCFA</div>
            <div class="kpi-label">Cette semaine</div>
            <div class="kpi-sub">{{ stats?.semaine?.ventes ?? 0 }} vente(s)</div>
          </div>
        </div>

        <div class="kpi-card" style="--glow: #6c5ce7; --glow2: #a29bfe;">
          <div class="kpi-icon-wrap">
            <mat-icon>calendar_month</mat-icon>
          </div>
          <div class="kpi-body">
            <div class="kpi-value">{{ stats?.mois?.total | number:'1.0-0' }}</div>
            <div class="kpi-unit">FCFA</div>
            <div class="kpi-label">Ce mois</div>
            <div class="kpi-sub">{{ stats?.mois?.ventes ?? 0 }} vente(s)</div>
          </div>
        </div>

        <div class="kpi-card" style="--glow: #e17055; --glow2: #fd79a8;">
          <div class="kpi-icon-wrap">
            <mat-icon>bar_chart</mat-icon>
          </div>
          <div class="kpi-body">
            <div class="kpi-value">{{ stats?.annee?.total | number:'1.0-0' }}</div>
            <div class="kpi-unit">FCFA</div>
            <div class="kpi-label">Cette année</div>
            <div class="kpi-sub">{{ stats?.annee?.ventes ?? 0 }} vente(s)</div>
          </div>
        </div>
      </div>

      <!-- Accès rapide -->
      <div class="section-title">Accès rapide</div>
      <div class="shortcut-grid">
        <a class="shortcut-card" routerLink="/patron/produits">
          <div class="sc-icon" style="--sc: #00b894;">
            <mat-icon>inventory_2</mat-icon>
          </div>
          <span>Produits</span>
        </a>
        <a class="shortcut-card" routerLink="/patron/agents">
          <div class="sc-icon" style="--sc: #0984e3;">
            <mat-icon>badge</mat-icon>
          </div>
          <span>Agents</span>
        </a>
        <a class="shortcut-card" routerLink="/patron/ventes">
          <div class="sc-icon" style="--sc: #6c5ce7;">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <span>Ventes</span>
        </a>
        <a class="shortcut-card" routerLink="/patron/produits" [class.has-alert]="alertes > 0">
          <div class="sc-icon" style="--sc: #e17055;">
            <mat-icon>{{ alertes > 0 ? 'warning' : 'inventory' }}</mat-icon>
          </div>
          <span>Stock bas <span class="badge" *ngIf="alertes > 0">{{ alertes }}</span></span>
        </a>
      </div>

      <!-- Méthodes paiement -->
      <div *ngIf="stats?.paiements?.length">
        <div class="section-title">Paiements du mois</div>
        <div class="paiement-list">
          <div class="paiement-item" *ngFor="let p of stats.paiements">
            <span class="paiement-name">{{ p._id | titlecase }}</span>
            <div class="paiement-bar-wrap">
              <div class="paiement-bar" [style.width.%]="getPourcentage(p.count)"></div>
            </div>
            <span class="paiement-count">{{ p.count }}</span>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dashboard { max-width: 800px; margin: 0 auto; padding-bottom: 32px; }

    /* ── Greeting ── */
    .greeting-block { margin-bottom: 24px; }
    .greeting-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
    .hand { font-size: 32px; line-height: 1; }
    .greeting-sub { color: var(--text-3); font-size: 13px; }
    .greeting-name { color: var(--text-1); font-size: 26px; font-weight: 800; line-height: 1.1; }
    .greeting-date { color: var(--text-3); font-size: 13px; margin-top: 4px; margin-left: 2px; }

    /* ── KPI grid glass ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 28px;
    }
    .kpi-card {
      position: relative;
      border-radius: 18px;
      padding: 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.07);
      backdrop-filter: blur(12px);
      overflow: hidden;
      transition: transform .2s, box-shadow .2s;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at top left, color-mix(in srgb, var(--glow) 18%, transparent), transparent 65%);
      pointer-events: none;
    }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,.25); }
    .kpi-icon-wrap {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--glow) 20%, transparent);
      border: 1px solid color-mix(in srgb, var(--glow) 35%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kpi-icon-wrap mat-icon {
      color: var(--glow);
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .kpi-body { flex: 1; min-width: 0; }
    .kpi-value {
      font-size: 18px;
      font-weight: 800;
      color: var(--text-1);
      line-height: 1;
    }
    .kpi-unit { font-size: 10px; color: var(--glow); font-weight: 700; margin: 1px 0 4px; letter-spacing: .5px; }
    .kpi-label { font-size: 11px; color: var(--text-2); font-weight: 600; }
    .kpi-sub { font-size: 10px; color: var(--text-3); margin-top: 2px; }

    /* ── Sections ── */
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-3);
      letter-spacing: .8px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    /* ── Shortcut grid ── */
    .shortcut-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 28px;
    }
    @media (max-width: 400px) {
      .shortcut-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .shortcut-card {
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 14px;
      padding: 16px 8px 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      transition: background .15s, border-color .15s, transform .15s;
    }
    .shortcut-card:hover { background: rgba(255,255,255,.07); transform: translateY(-1px); }
    .shortcut-card.has-alert { border-color: rgba(225,112,85,.3); }
    .sc-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--sc) 15%, transparent);
      border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sc-icon mat-icon { color: var(--sc); font-size: 22px; width: 22px; height: 22px; }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #e17055;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      margin-left: 3px;
    }

    /* ── Paiements ── */
    .paiement-list { display: flex; flex-direction: column; gap: 8px; }
    .paiement-item { display: flex; align-items: center; gap: 10px; }
    .paiement-name { color: var(--text-2); font-size: 12px; min-width: 70px; }
    .paiement-bar-wrap { flex: 1; background: rgba(255,255,255,.06); border-radius: 4px; height: 6px; overflow: hidden; }
    .paiement-bar { height: 100%; background: var(--accent); border-radius: 4px; transition: width .4s; }
    .paiement-count { color: var(--text-3); font-size: 12px; min-width: 24px; text-align: right; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats: any = null;
  alertes = 0;
  nomPatron = 'Patron';
  today = '';
  private destroy$ = new Subject<void>();

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    this.nomPatron = user?.nom || user?.prenom || 'Patron';
    const now = new Date();
    this.today = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    forkJoin({
      stats: this.api.get('ventes/stats').pipe(
        timeout(10000),
        retry({ count: 2, delay: 3000 }),
        catchError((err) => {
          console.error('Erreur chargement stats dashboard patron:', err?.status, err?.error?.message || err?.message);
          return of(null);
        }),
      ),
      alertes: this.api.get('produits/alerte').pipe(
        timeout(10000),
        retry({ count: 2, delay: 3000 }),
        catchError(() => of({ data: [] })),
      ),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ stats, alertes }: any) => {
      if (stats?.success) this.stats = stats.data;
      this.alertes = alertes?.data?.length ?? 0;
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  get margePctMois(): number {
    const total = this.stats?.mois?.total || 0;
    const marge = this.stats?.mois?.marge || 0;
    if (!total) return 0;
    return Math.round((marge / total) * 100);
  }

  getPourcentage(count: number): number {
    const max = Math.max(...(this.stats?.paiements?.map((p: any) => p.count) ?? [1]));
    return max ? Math.round((count / max) * 100) : 0;
  }
}
