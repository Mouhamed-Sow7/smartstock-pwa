import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PosService, SaleTicket } from '../services/pos.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="ticket-page">
      <div class="page-title">
        <mat-icon>receipt_long</mat-icon>
        <div>
          <div class="title-main">Ticket de Caisse</div>
          <div class="title-sub">Imprimez votre reçu</div>
        </div>
      </div>

      <div class="empty-state" *ngIf="!ticket">
        <mat-icon>receipt</mat-icon>
        <div class="empty-title">Aucun ticket récent</div>
        <div class="empty-sub">Validez une vente pour générer un ticket</div>
        <a routerLink="/agent/scan" class="new-sale-btn">
          <mat-icon>qr_code_scanner</mat-icon> Nouvelle vente
        </a>
      </div>

      <div class="ticket-card" *ngIf="ticket">
        <div class="offline-badge" *ngIf="ticket.modeCreation === 'offline'">
          <mat-icon>wifi_off</mat-icon>
          Vente hors ligne — sera synchronisée
        </div>

        <div class="ticket-header">
          <div class="ticket-shop">{{ shopName }}</div>
          <div class="ticket-num">{{ ticket.numeroTicket }}</div>
          <div class="ticket-date">{{ ticket.createdAt | date:'dd/MM/yyyy HH:mm' }}</div>
        </div>

        <div class="divider"></div>

        <div class="ticket-lines">
          <div class="ticket-line" *ngFor="let item of ticket.items">
            <div class="line-nom">{{ item.produit?.nom }}</div>
            <div class="line-qty">×{{ item.quantite }}</div>
            <div class="line-total">{{ item.prix * item.quantite | number:'1.0-0' }} F</div>
          </div>
        </div>

        <div class="divider dashed"></div>

        <div class="ticket-total">
          <span>Total</span>
          <span class="total-amount">{{ ticket.total | number:'1.0-0' }} FCFA</span>
        </div>

        <div class="ticket-payment">
          <mat-icon>payments</mat-icon>
          {{ ticket.modePaiement | titlecase }}
        </div>

        <div class="divider"></div>

        <div class="print-actions">
          <button class="print-btn" (click)="print('58mm')">
            <mat-icon>print</mat-icon> 58 mm
          </button>
          <button class="print-btn" (click)="print('80mm')">
            <mat-icon>print</mat-icon> 80 mm
          </button>
        </div>

        <a routerLink="/agent/scan" class="new-sale-btn">
          <mat-icon>add_circle_outline</mat-icon> Nouvelle vente
        </a>
      </div>
    </div>
  `,
  styles: [`
    .ticket-page { max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .page-title { display: flex; align-items: center; gap: 12px; }
    .page-title mat-icon { color: #9b59b6; font-size: 28px; width: 28px; height: 28px; }
    .title-main { color: var(--text-1); font-size: 22px; font-weight: 700; }
    .title-sub { color: var(--text-3); font-size: 12px; }
    .empty-state { background: var(--navy-card); border: 1px solid var(--navy-border); border-radius: 16px; padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--text-3); }
    .empty-title { color: var(--text-2); font-size: 16px; font-weight: 600; }
    .empty-sub { color: var(--text-3); font-size: 13px; }
    .ticket-card { background: var(--navy-card); border: 1px solid var(--navy-border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .offline-badge { background: rgba(243,156,18,.12); border: 1px solid rgba(243,156,18,.25); border-radius: 10px; padding: 8px 12px; color: var(--warning); font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .ticket-header { text-align: center; }
    .ticket-shop { color: var(--text-1); font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .ticket-num { color: var(--accent); font-size: 13px; font-weight: 600; font-family: monospace; }
    .ticket-date { color: var(--text-3); font-size: 12px; margin-top: 2px; }
    .divider { height: 1px; background: var(--navy-border); }
    .divider.dashed { background: repeating-linear-gradient(90deg, var(--navy-border) 0 8px, transparent 8px 16px); }
    .ticket-lines { display: flex; flex-direction: column; gap: 8px; }
    .ticket-line { display: flex; align-items: center; gap: 8px; }
    .line-nom { color: var(--text-2); font-size: 13px; flex: 1; }
    .line-qty { color: var(--text-3); font-size: 12px; min-width: 28px; text-align: center; }
    .line-total { color: var(--text-1); font-size: 13px; font-weight: 600; min-width: 80px; text-align: right; }
    .ticket-total { display: flex; justify-content: space-between; align-items: center; }
    .ticket-total span { color: var(--text-2); font-size: 14px; font-weight: 600; }
    .total-amount { color: var(--accent) !important; font-size: 22px !important; font-weight: 700 !important; }
    .ticket-payment { display: flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 12px; }
    .print-actions { display: flex; gap: 10px; }
    .print-btn { flex: 1; padding: 12px; background: var(--accent-lite); border: 1px solid rgba(0,184,148,.3); border-radius: 10px; color: var(--accent); font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
    .new-sale-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: rgba(255,255,255,.05); border: 1px solid var(--navy-border); border-radius: 12px; color: var(--text-2); font-size: 14px; font-weight: 600; text-decoration: none; }
  `]
})
export class TicketComponent implements OnInit, OnDestroy {
  ticket: SaleTicket | null = null;
  shopName = 'SmartStock';
  private destroy$ = new Subject<void>();

  constructor(private pos: PosService, private auth: AuthService) {}

  ngOnInit(): void {
    this.shopName = this.auth.getUser()?.boutique || 'SmartStock';
    this.pos.lastTicket$.pipe(takeUntil(this.destroy$)).subscribe(t => this.ticket = t);
  }

  print(width: '58mm' | '80mm'): void {
    this.pos.printTicket(width, this.shopName);
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
