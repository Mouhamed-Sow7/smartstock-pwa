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
        background: #1a1a2e;
        color: white;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        height: 56px;
      }
      .app-title {
        font-weight: 700;
        font-size: 18px;
        margin-left: 8px;
      }
      .spacer {
        flex: 1;
      }
      .tenant-name {
        font-size: 13px;
        opacity: 0.7;
        margin-right: 8px;
      }
      .sidenav-container {
        margin-top: 56px;
        height: calc(100vh - 56px);
        overflow: hidden;
      }
      .sidenav {
        width: 260px;
        background: #1a1a2e;
        height: 100%;
      }
      .mat-sidenav-content,
      .main-content {
        height: 100%;
        overflow-y: auto;
      }
      .sidenav-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 16px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #00b894;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 16px;
      }
      .user-name {
        color: white;
        font-weight: 600;
        font-size: 15px;
      }
      .user-role {
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
      }
      mat-nav-list a {
        color: white !important;
        margin: 4px 8px;
        border-radius: 8px;
        font-weight: 600;
        display: flex !important;
        align-items: center;
      }
      mat-nav-list a span {
        color: white !important;
        font-size: 14px !important;
      }
      mat-nav-list a.active {
        background: rgba(0, 184, 148, 0.3) !important;
      }
      mat-nav-list a.active span {
        color: #00ffa8 !important;
      }
      mat-nav-list a mat-icon {
        color: white !important;
      }
      mat-nav-list a.active mat-icon {
        color: #00ffa8 !important;
      }
      .main-content {
        background: #f8f9fa;
        min-height: 100%;
        padding: 24px 16px;
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
