import { Component, OnDestroy, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface VenteHisto {
  _id: string;
  numeroTicket: string;
  createdAt: string;
  montantTotal: number;
  modePaiement: string;
  produits: { nom: string; quantite: number }[];
}

@Component({
  selector: 'app-agent-historique',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="historique-page">
      <div class="histo-header">
        <h1>Historique des ventes</h1>
        <button class="reload-btn" (click)="charger()" [disabled]="_isLoading" title="Actualiser">
          <mat-icon [class.spin]="_isLoading">refresh</mat-icon>
        </button>
      </div>
      <div class="sub" *ngIf="!_isLoading && !_error">{{ _ventes.length }} vente(s)</div>

      <div class="loader" *ngIf="_isLoading">
        <mat-icon class="spin">autorenew</mat-icon> Chargement...
      </div>

      <div class="error-state" *ngIf="_error && !_isLoading">
        <mat-icon>wifi_off</mat-icon>
        <p>Impossible de charger l'historique</p>
        <button class="retry-btn" (click)="charger()">Réessayer</button>
      </div>

      <div class="empty" *ngIf="!_isLoading && !_error && _ventes.length === 0">
        <mat-icon>receipt_long</mat-icon>
        <p>Aucune vente pour le moment</p>
      </div>

      <div class="vente-card" *ngFor="let v of _ventes">
        <div class="vente-top">
          <span class="ticket">{{ v.numeroTicket }}</span>
          <span class="montant">{{ v.montantTotal | number: '1.0-0' }} F</span>
        </div>
        <div class="vente-mid">
          <span class="badge">{{ v.modePaiement }}</span>
          <span class="date">{{ v.createdAt | date: 'dd/MM HH:mm' }}</span>
        </div>
        <div class="vente-items">
          <span class="item" *ngFor="let p of v.produits">{{ p.nom }} ×{{ p.quantite }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .historique-page { max-width: 600px; margin: 0 auto; }
    .histo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    h1 { font-size: 22px; font-weight: 700; color: var(--text-1); margin: 0; }
    .reload-btn {
      width: 36px; height: 36px; border-radius: 10px; border: none;
      background: rgba(255,255,255,.06); color: var(--text-2);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .reload-btn:hover { background: rgba(255,255,255,.12); color: var(--accent); }
    .reload-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .sub { color: var(--text-3); font-size: 12px; margin-bottom: 16px; }

    .loader { display: flex; align-items: center; gap: 8px; color: var(--text-3); padding: 24px 0; justify-content: center; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-state { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-3); padding: 40px 0; text-align: center; }
    .error-state mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--danger); opacity: .7; }
    .retry-btn {
      padding: 8px 20px; border-radius: 10px; border: 1px solid var(--accent);
      background: var(--accent-lite); color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer;
    }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-3); padding: 48px 0; }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .5; }

    .vente-card {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 14px; padding: 14px; margin-bottom: 10px; backdrop-filter: blur(12px);
    }
    .vente-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .ticket { color: var(--accent); font-size: 13px; font-weight: 700; font-family: monospace; }
    .montant { color: var(--text-1); font-size: 16px; font-weight: 700; }
    .vente-mid { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .badge {
      background: var(--accent-lite); color: var(--accent);
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 10px;
    }
    .date { color: var(--text-3); font-size: 11px; }
    .vente-items { display: flex; flex-wrap: wrap; gap: 6px; }
    .item { background: rgba(255,255,255,.05); color: var(--text-2); font-size: 11px; padding: 3px 8px; border-radius: 8px; }
  `],
})
export class AgentHistoriqueComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  _ventes: VenteHisto[] = [];
  _isLoading = false;
  _error = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    const user = this.auth.getUser();
    const userId = user?._id || user?.id;
    const path = userId ? `ventes?agentId=${userId}` : 'ventes';

    this._isLoading = true;
    this._error = false;
    this.cdr.detectChanges();

    this.api.get(path).pipe(
      catchError(err => {
        console.error('Historique agent:', err?.status, err?.message);
        return of(null);
      }),
      takeUntil(this.destroy$),
    ).subscribe((res: any) => {
      // NgZone.run() garantit que Angular détecte le changement
      // même si l'observable se résout hors zone (cas des retries longs)
      this.zone.run(() => {
        if (res?.success) {
          this._ventes = res.data ?? [];
          this._error = false;
        } else {
          this._error = true;
        }
        this._isLoading = false;
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
