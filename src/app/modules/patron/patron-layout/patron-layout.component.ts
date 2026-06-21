import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SyncService } from '../../../core/services/sync.service';

@Component({
  selector: 'app-patron-layout',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule,
  ],
  template: `
    <div class="topbar">
      <span class="app-title">SmartStock</span>
      <span class="spacer"></span>
      <span class="offline-dot" *ngIf="!sync.estEnLigne()" matTooltip="Hors ligne">
        <mat-icon>wifi_off</mat-icon>
      </span>
      <span class="pending-badge" *ngIf="sync.ventesPendingCount() > 0">
        {{ sync.ventesPendingCount() }} en attente
      </span>
      <span class="tenant-name">{{ user?.boutique || 'Ma boutique' }}</span>
      <button mat-icon-button (click)="logout()" style="color:var(--text-2)">
        <mat-icon>logout</mat-icon>
      </button>
    </div>

    <!-- Bandeau sync -->
    <div class="sync-banner" *ngIf="sync.afficherBandeau()">
      <mat-icon>{{ sync.estEnLigne() ? 'sync' : 'wifi_off' }}</mat-icon>
      <span *ngIf="!sync.estEnLigne()">Mode hors ligne — les ventes seront synchronisées à la reconnexion</span>
      <span *ngIf="sync.estEnLigne() && sync.ventesPendingCount() > 0">
        {{ sync.ventesPendingCount() }} vente(s) en attente de synchronisation
      </span>
      <button *ngIf="sync.estEnLigne() && sync.ventesPendingCount() > 0"
        class="sync-btn" (click)="sync.synchroniser()">Synchroniser</button>
    </div>

    <main class="main-content" [class.with-banner]="sync.afficherBandeau()">
      <router-outlet></router-outlet>
    </main>

    <nav class="bottom-nav">
      <a routerLink="/patron/dashboard" routerLinkActive="active">
        <mat-icon>home</mat-icon>
        <span>Dashboard</span>
      </a>
      <a routerLink="/patron/produits" routerLinkActive="active">
        <mat-icon>inventory_2</mat-icon>
        <span>Produits</span>
      </a>
      <a routerLink="/patron/agents" routerLinkActive="active">
        <mat-icon>badge</mat-icon>
        <span>Agents</span>
      </a>
      <a routerLink="/patron/ventes" routerLinkActive="active">
        <mat-icon>receipt_long</mat-icon>
        <span>Ventes</span>
      </a>
    </nav>
  `,
  styles: [`
    .topbar {
      background: rgba(15,27,45,.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--navy-border);
      color: var(--text-1);
      position: fixed;
      top: var(--safe-top);
      left: 0; right: 0;
      z-index: 100;
      height: var(--topbar-h);
      display: flex;
      align-items: center;
      padding: 0 8px 0 16px;
    }
    .app-title { font-weight: 700; font-size: 16px; letter-spacing: .3px; }
    .spacer { flex: 1; }
    .offline-dot mat-icon { color: var(--warning); font-size: 20px; margin-right: 4px; }
    .pending-badge {
      background: rgba(243,156,18,.15);
      color: var(--warning);
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 20px;
      margin-right: 6px;
    }
    .tenant-name {
      background: var(--accent-lite);
      color: var(--accent);
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid rgba(0,184,148,.25);
      margin-right: 4px;
    }

    .sync-banner {
      position: fixed;
      top: calc(var(--safe-top) + var(--topbar-h));
      left: 0; right: 0;
      z-index: 99;
      background: rgba(243,156,18,.12);
      border-bottom: 1px solid rgba(243,156,18,.25);
      color: var(--warning);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sync-banner mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .sync-btn {
      margin-left: auto;
      padding: 4px 12px;
      border-radius: 20px;
      background: var(--warning);
      color: #000;
      border: none;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    .main-content {
      position: fixed;
      top: calc(var(--safe-top) + var(--topbar-h));
      bottom: calc(var(--safe-bot) + var(--nav-h));
      left: 0;
      right: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      background: var(--navy);
      padding: 16px;
    }
    .main-content.with-banner {
      top: calc(var(--safe-top) + var(--topbar-h) + 33px);
    }

    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(var(--nav-h) + var(--safe-bot));
      padding-bottom: var(--safe-bot);
      background: rgba(15, 27, 45, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid var(--navy-border);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      z-index: 100;
    }
    .bottom-nav a {
      color: var(--text-3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      line-height: 1;
      font-size: 10px;
      font-weight: 500;
      transition: color 0.2s;
      position: relative;
    }
    .bottom-nav a.active { color: var(--accent); }
    .bottom-nav a.active::before {
      content: '';
      position: absolute;
      top: 0;
      left: 20%;
      right: 20%;
      height: 2px;
      background: var(--accent);
      border-radius: 0 0 4px 4px;
    }
    .bottom-nav mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      line-height: 1;
      display: block;
    }
  `]
})
export class PatronLayoutComponent {
  user: any;

  constructor(
    private auth: AuthService,
    public sync: SyncService,
    private router: Router,
  ) {
    this.user = this.auth.getUser();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
