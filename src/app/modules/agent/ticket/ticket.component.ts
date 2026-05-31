import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PosService, SaleTicket } from '../services/pos.service';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  template: `
    <div class="ticket-page">
      <!-- Header -->
      <div class="page-title">
        <mat-icon>receipt_long</mat-icon>
        <div>
          <div class="title-main">Ticket de Caisse</div>
          <div class="title-sub">Imprimez votre reçu</div>
        </div>
      </div>

      <!-- Aucun ticket -->
      <div class="empty-state" *ngIf="!ticket">
        <mat-icon>receipt</mat-icon>
        <div class="empty-title">Aucun ticket récent</div>
        <div class="empty-sub">Validez une vente pour générer un ticket</div>
        <a routerLink="/agent/scan" class="new-sale-btn">
          <mat-icon>qr_code_scanner</mat-icon>
          Nouvelle vente
        </a>
      </div>

      <!-- Aperçu ticket -->
      <div class="ticket-card" *ngIf="ticket">
        <!-- Badge offline -->
        <div class="offline-badge" *ngIf="ticket.modeCreation === 'offline'">
          <mat-icon>wifi_off</mat-icon>
          Vente hors ligne — en attente de synchronisation
        </div>

        <!-- Entête ticket -->
        <div class="ticket-header">
          <div class="ticket-shop">SmartStock</div>
          <div class="ticket-num">{{ ticket.numeroTicket }}</div>
          <div class="ticket-date">{{ ticket.createdAt | date: 'dd/MM/yyyy HH:mm' }}</div>
        </div>

        <div class="divider"></div>

        <!-- Lignes articles -->
        <div class="ticket-lines">
          <div class="ticket-line" *ngFor="let item of ticket.items">
            <div class="line-nom">{{ item.produit?.nom }}</div>
            <div class="line-qty">x{{ item.quantite }}</div>
            <div class="line-total">{{ item.prix * item.quantite | number: '1.0-0' }} FCFA</div>
          </div>
        </div>

        <div class="divider dashed"></div>

        <!-- Total -->
        <div class="ticket-total">
          <span>Total</span>
          <span class="total-amount">{{ ticket.total | number: '1.0-0' }} FCFA</span>
        </div>

        <!-- Mode paiement -->
        <div class="ticket-payment">
          <mat-icon>payments</mat-icon>
          {{ ticket.modePaiement | titlecase }}
        </div>

        <div class="divider"></div>

        <!-- Actions impression -->
        <div class="print-actions">
          <button class="print-btn" (click)="print('58mm')">
            <mat-icon>print</mat-icon>
            58 mm
          </button>
          <button class="print-btn" (click)="print('80mm')">
            <mat-icon>print</mat-icon>
            80 mm
          </button>
        </div>

        <!-- Nouvelle vente -->
        <a routerLink="/agent/scan" class="new-sale-btn">
          <mat-icon>add_circle_outline</mat-icon>
          Nouvelle vente
        </a>
      </div>
    </div>
  `,
  styles: [
    `
      .ticket-page {
        max-width: 500px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      /* Header */
      .page-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
      }
      .page-title mat-icon {
        color: #9b59b6;
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
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--text-3);
      }
      .empty-title {
        color: var(--text-2);
        font-size: 16px;
        font-weight: 600;
      }
      .empty-sub {
        color: var(--text-3);
        font-size: 13px;
      }

      /* Ticket card */
      .ticket-card {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 16px;
        padding: 20px;
        backdrop-filter: blur(12px);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* Offline badge */
      .offline-badge {
        background: rgba(243, 156, 18, 0.12);
        border: 1px solid rgba(243, 156, 18, 0.25);
        border-radius: 10px;
        padding: 8px 12px;
        color: var(--warning);
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .offline-badge mat-icon {
        font-size: 16px;
      }

      /* Ticket header */
      .ticket-header {
        text-align: center;
      }
      .ticket-shop {
        color: var(--text-1);
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .ticket-num {
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
        font-family: monospace;
      }
      .ticket-date {
        color: var(--text-3);
        font-size: 12px;
        margin-top: 2px;
      }

      /* Divider */
      .divider {
        height: 1px;
        background: var(--navy-border);
      }
      .divider.dashed {
        background: repeating-linear-gradient(
          90deg,
          var(--navy-border) 0 8px,
          transparent 8px 16px
        );
      }

      /* Lines */
      .ticket-lines {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ticket-line {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .line-nom {
        color: var(--text-2);
        font-size: 13px;
        flex: 1;
      }
      .line-qty {
        color: var(--text-3);
        font-size: 12px;
        min-width: 28px;
        text-align: center;
      }
      .line-total {
        color: var(--text-1);
        font-size: 13px;
        font-weight: 600;
        min-width: 80px;
        text-align: right;
      }

      /* Total */
      .ticket-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .ticket-total span {
        color: var(--text-2);
        font-size: 14px;
        font-weight: 600;
      }
      .total-amount {
        color: var(--accent) !important;
        font-size: 22px !important;
        font-weight: 700 !important;
      }

      /* Paiement */
      .ticket-payment {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-3);
        font-size: 12px;
      }
      .ticket-payment mat-icon {
        font-size: 16px;
      }

      /* Print */
      .print-actions {
        display: flex;
        gap: 10px;
      }
      .print-btn {
        flex: 1;
        padding: 12px;
        background: var(--accent-lite);
        border: 1px solid rgba(0, 184, 148, 0.3);
        border-radius: 10px;
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
      }
      .print-btn mat-icon {
        font-size: 18px;
      }

      /* New sale */
      .new-sale-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--navy-border);
        border-radius: 12px;
        color: var(--text-2);
        font-size: 14px;
        font-weight: 600;
        margin-top: 4px;
        transition: background 0.2s;
      }
      .new-sale-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-1);
      }
      .new-sale-btn mat-icon {
        color: var(--accent);
        font-size: 20px;
      }
    `,
  ],
})
export class TicketComponent implements OnInit, OnDestroy {
  ticket: SaleTicket | null = null;
  private destroy$ = new Subject<void>();

  constructor(private pos: PosService) {}

  ngOnInit(): void {
    this.pos.lastTicket$.pipe(takeUntil(this.destroy$)).subscribe((ticket) => {
      this.ticket = ticket;
    });
  }

  print(width: '58mm' | '80mm'): void {
    this.pos.printTicket(width);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
