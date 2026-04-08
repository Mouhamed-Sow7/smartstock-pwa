import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PosService, SaleTicket } from '../services/pos.service';
@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-container">
      <h1>Ticket de Caisse</h1>
      <p>Imprimez votre ticket</p>

      <div *ngIf="!ticket">Aucun ticket récent.</div>

      <div *ngIf="ticket" class="ticket-preview">
        <p><strong>N°:</strong> {{ ticket.numeroTicket }}</p>
        <p><strong>Date:</strong> {{ ticket.createdAt | date: 'short' }}</p>
        <p><strong>Total:</strong> {{ ticket.total | number: '1.0-0' }} FCFA</p>
        <button (click)="print('58mm')">Imprimer 58mm</button>
        <button (click)="print('80mm')">Imprimer 80mm</button>
      </div>

      <a routerLink="/agent/scan">Nouvelle vente</a>
    </div>
  `,
  styles: [
    `
      .page-container {
        padding: 16px;
      }
      .ticket-preview {
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 12px;
        margin: 10px 0;
      }
      button {
        margin-right: 8px;
        border: none;
        border-radius: 6px;
        padding: 8px 10px;
        background: #00b894;
        color: #fff;
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
      if (ticket) {
        this.pos.printTicket('58mm');
      }
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
