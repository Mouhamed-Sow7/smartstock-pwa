import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-agent-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <mat-toolbar class="topbar">
      <span class="app-title">SmartStock Agent</span>
      <span class="spacer"></span>
      <span class="tenant-name">{{ user?.boutique || 'Boutique' }}</span>
      <button mat-icon-button (click)="logout()">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <main class="main-content">
      <router-outlet></router-outlet>
    </main>

    <nav class="bottom-nav">
      <a routerLink="/agent/dashboard" routerLinkActive="active">
        <mat-icon>home</mat-icon>
        <span>Accueil</span>
      </a>
      <a routerLink="/agent/scan" routerLinkActive="active">
        <mat-icon>qr_code_scanner</mat-icon>
        <span>Scan</span>
      </a>
      <a routerLink="/agent/panier" routerLinkActive="active">
        <mat-icon>shopping_cart</mat-icon>
        <span>Panier</span>
      </a>
      <a routerLink="/agent/ticket" routerLinkActive="active">
        <mat-icon>receipt_long</mat-icon>
        <span>Ticket</span>
      </a>
    </nav>
  `,
  styles: [
    `
      .topbar {
        background: #1a1a2e;
        color: #fff;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        height: 56px;
      }
      .app-title {
        font-weight: 700;
      }
      .spacer {
        flex: 1;
      }
      .tenant-name {
        font-size: 12px;
        opacity: 0.75;
        margin-right: 6px;
      }
      .main-content {
        margin-top: 56px;
        margin-bottom: 72px;
        height: calc(100vh - 128px);
        overflow-y: auto;
        background: #f8f9fa;
        padding: 16px;
      }
      .bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 72px;
        background: #fff;
        border-top: 1px solid #e9ecef;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        z-index: 120;
      }
      .bottom-nav a {
        text-decoration: none;
        color: #6c757d;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
      }
      .bottom-nav a.active {
        color: #00b894;
      }
      .bottom-nav mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    `,
  ],
})
export class AgentLayoutComponent {
  user: any = null;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    this.user = this.auth.getUser();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
