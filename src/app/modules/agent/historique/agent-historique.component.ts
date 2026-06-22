import { Component, OnDestroy, OnInit } from '@angular/core';
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
      <h1>Historique des ventes</h1>
      <div class="sub" *ngIf="!_isLoading">{{ _ventes.length }} vente(s)</div>

      <div class="loader" *ngIf="_isLoading">
        <mat-icon class="spin">autorenew</mat-icon> Chargement...
      </div>

      <div class="empty" *ngIf="!_isLoading && _ventes.length === 0">
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
    h1 { font-size: 22px; font-weight: 700; color: var(--text-1); margin-bottom: 4px; }
    .sub { color: var(--text-3); font-size: 12px; margin-bottom: 16px; }

    .loader {
      display: flex; align-items: center; gap: 8px;
      color: var(--text-3); padding: 24px 0; justify-content: center;
    }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; color: var(--text-3); padding: 48px 0;
    }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .5; }

    .vente-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 10px;
      backdrop-filter: blur(12px);
    }
    .vente-top {
      display: flex; justify-content: space-between;
      align-items: center; margin-bottom: 6px;
    }
    .ticket { color: var(--accent); font-size: 13px; font-weight: 700; font-family: monospace; }
    .montant { color: var(--text-1); font-size: 16px; font-weight: 700; }
    .vente-mid {
      display: flex; justify-content: space-between;
      align-items: center; margin-bottom: 8px;
    }
    .badge {
      background: var(--accent-lite); color: var(--accent);
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 3px 8px; border-radius: 10px;
    }
    .date { color: var(--text-3); font-size: 11px; }
    .vente-items { display: flex; flex-wrap: wrap; gap: 6px; }
    .item {
      background: rgba(255,255,255,.05); color: var(--text-2);
      font-size: 11px; padding: 3px 8px; border-radius: 8px;
    }
  `],
})
export class AgentHistoriqueComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  _ventes: VenteHisto[] = [];
  _isLoading = true;

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    const userId = this.auth.getUser()?.id;
    const path = userId ? `ventes?agentId=${userId}` : 'ventes';
    this.api.get(path).pipe(
      catchError(err => {
        console.error('Historique agent:', err?.status, err?.error?.message);
        return of({ success: false, data: [] });
      }),
      takeUntil(this.destroy$),
    ).subscribe((res: any) => {
      this._ventes = res?.data ?? [];
      this._isLoading = false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
