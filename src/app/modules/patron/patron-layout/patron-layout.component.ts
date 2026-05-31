import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-patron-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <mat-toolbar class="topbar">
      <button mat-icon-button (click)="sidenav.toggle()">
        <mat-icon>menu</mat-icon>
      </button>
      <span class="app-title">SmartStock</span>
      <span class="spacer"></span>
      <span class="tenant-name">{{ user?.boutique || 'Ma boutique' }}</span>
      <button mat-icon-button (click)="logout()">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav #sidenav mode="over" class="sidenav">
        <div class="sidenav-header">
          <div class="avatar">{{ initiales }}</div>
          <div class="user-info">
            <div class="user-name">{{ user?.nom || 'Patron' }}</div>
            <div class="user-role">Administrateur</div>
          </div>
        </div>
        <mat-nav-list>
          <a
            mat-list-item
            routerLink="/patron/dashboard"
            routerLinkActive="active"
            (click)="sidenav.close()"
          >
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a
            mat-list-item
            routerLink="/patron/produits"
            routerLinkActive="active"
            (click)="sidenav.close()"
          >
            <mat-icon matListItemIcon>inventory_2</mat-icon>
            <span matListItemTitle>Produits</span>
          </a>
          <a
            mat-list-item
            routerLink="/patron/agents"
            routerLinkActive="active"
            (click)="sidenav.close()"
          >
            <mat-icon matListItemIcon>badge</mat-icon>
            <span matListItemTitle>Agents</span>
          </a>
          <a
            mat-list-item
            routerLink="/patron/ventes"
            routerLinkActive="active"
            (click)="sidenav.close()"
          >
            <mat-icon matListItemIcon>receipt_long</mat-icon>
            <span matListItemTitle>Ventes</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="main-content">
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .topbar {
        background: rgba(15, 27, 45, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--navy-border);
        color: var(--text-1);
        position: fixed;
        top: var(--safe-top);
        left: 0;
        right: 0;
        z-index: 100;
        height: var(--topbar-h);
        display: flex;
        align-items: center;
        padding: 0 8px 0 4px;
      }
      .app-title {
        font-weight: 700;
        font-size: 16px;
        margin-left: 4px;
        flex: 1;
      }
      .tenant-name {
        background: var(--accent-lite);
        color: var(--accent);
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 20px;
        border: 1px solid rgba(0, 184, 148, 0.25);
        margin-right: 4px;
      }

      .sidenav-container {
        position: fixed;
        top: calc(var(--safe-top) + var(--topbar-h));
        bottom: 0;
        left: 0;
        right: 0;
        height: calc(100dvh - var(--topbar-h) - var(--safe-top));
      }

      .sidenav {
        width: 260px;
        background: var(--navy-light);
        border-right: 1px solid var(--navy-border);
      }

      .sidenav-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 16px 16px;
        border-bottom: 1px solid var(--navy-border);
      }
      .avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--accent-glow);
        border: 2px solid var(--accent);
        color: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 16px;
      }
      .user-name {
        color: var(--text-1);
        font-weight: 600;
        font-size: 15px;
      }
      .user-role {
        color: var(--text-3);
        font-size: 12px;
      }

      mat-nav-list a {
        color: var(--text-2) !important;
        margin: 4px 8px;
        border-radius: 10px !important;
      }
      mat-nav-list a span {
        color: var(--text-2) !important;
        font-size: 14px !important;
      }
      mat-nav-list a mat-icon {
        color: var(--text-3) !important;
      }
      mat-nav-list a.active {
        background: var(--accent-lite) !important;
        border: 1px solid rgba(0, 184, 148, 0.2) !important;
      }
      mat-nav-list a.active span {
        color: var(--accent) !important;
      }
      mat-nav-list a.active mat-icon {
        color: var(--accent) !important;
      }

      .main-content {
        background: var(--navy);
        min-height: 100%;
        padding: 20px 16px;
        overflow-y: auto;
      }
    `,
  ],
})
export class PatronLayoutComponent {
  user: any;
  initiales = 'P';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    this.user = this.auth.getUser();
    if (this.user?.nom) {
      this.initiales = this.user.nom.charAt(0).toUpperCase();
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
