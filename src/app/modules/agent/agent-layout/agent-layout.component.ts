import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OfflineService } from '../../../core/services/offline.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { SyncService } from '../../../core/services/sync.service';

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
    MatSnackBarModule,
  ],
  template: `
    <div class="topbar">
      <span class="app-title">SmartStock Agent</span>
      <span class="status-badge">{{ user?.boutique || 'Boutique' }}</span>
      <button mat-icon-button (click)="onRefresh()" style="color:var(--text-2)" [class.spin]="isSyncing || sync.estEnSync()" aria-label="Rafraîchir">
        <mat-icon>autorenew</mat-icon>
      </button>
      <button mat-icon-button (click)="theme.toggle()" style="color:var(--text-2)">
        <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
      <button mat-icon-button (click)="logout()" style="color:var(--text-2)">
        <mat-icon>logout</mat-icon>
      </button>
    </div>

    <!-- Bandeau offline / sync en attente -->
    <div class="sync-banner" *ngIf="sync.afficherBandeau()">
      <mat-icon>{{ sync.estEnLigne() ? (sync.estEnSync() ? 'sync' : 'cloud_queue') : 'wifi_off' }}</mat-icon>
      <span *ngIf="!sync.estEnLigne()">Hors ligne — données sauvegardées localement</span>
      <span *ngIf="sync.estEnLigne() && sync.estEnSync()">Synchronisation en cours...</span>
      <span *ngIf="sync.estEnLigne() && !sync.estEnSync() && sync.totalPendingCount() > 0">
        {{ sync.totalPendingCount() }} élément(s) en attente de sync
      </span>
      <button *ngIf="sync.estEnLigne() && !sync.estEnSync() && sync.totalPendingCount() > 0"
        class="sync-now-btn" (click)="sync.synchroniser()">
        Synchroniser
      </button>
    </div>

    <main class="main-content">
      <router-outlet></router-outlet>
    </main>

    <nav class="bottom-nav">
      <a routerLink="/agent/dashboard" routerLinkActive="active">
        <mat-icon>home</mat-icon><span>Accueil</span>
      </a>
      <a routerLink="/agent/scan" routerLinkActive="active">
        <mat-icon>qr_code_scanner</mat-icon><span>Scan</span>
      </a>
      <a routerLink="/agent/panier" routerLinkActive="active">
        <mat-icon>shopping_cart</mat-icon><span>Panier</span>
      </a>
      <a routerLink="/agent/ticket" routerLinkActive="active">
        <mat-icon>receipt_long</mat-icon><span>Ticket</span>
      </a>
      <a routerLink="/agent/historique" routerLinkActive="active">
        <mat-icon>history</mat-icon><span>Historique</span>
      </a>
    </nav>
  `,
  styles: [
    `
      .topbar {
        background: var(--navy-light);
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
        padding: 0 8px 0 16px;
      }
      .app-title {
        font-weight: 700;
        font-size: 16px;
        letter-spacing: 0.3px;
        flex: 1;
      }
      .status-badge {
        background: var(--accent-lite);
        color: var(--accent);
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 20px;
        border: 1px solid rgba(0, 184, 148, 0.25);
        margin-right: 4px;
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

      /* Bandeau offline/sync */
      .sync-banner {
        display: flex; align-items: center; gap: 8px;
        background: rgba(243,156,18,.15);
        border-bottom: 1px solid rgba(243,156,18,.3);
        color: #f59e0b;
        font-size: 12px; font-weight: 600;
        padding: 7px 16px;
      }
      .sync-banner mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .sync-now-btn {
        margin-left: auto; padding: 3px 10px; border-radius: 8px;
        border: 1px solid rgba(243,156,18,.4); background: rgba(243,156,18,.15);
        color: #f59e0b; font-size: 11px; font-weight: 700; cursor: pointer;
      }

      /* ─── Bottom Nav ───────────────────────────────────── */
      .bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: calc(var(--nav-h) + var(--safe-bot));
        padding-bottom: var(--safe-bot);
        background: var(--navy-light);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-top: 1px solid var(--navy-border);
        display: grid;
        grid-template-columns: repeat(5, 1fr);
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
      .bottom-nav a.active {
        color: var(--accent);
      }
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

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .spin {
        animation: spin 1s linear infinite;
        display: inline-block;
      }
    `,
  ],
})
export class AgentLayoutComponent {
  user: any = null;
  isSyncing = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private offline: OfflineService,
    private snackBar: MatSnackBar,
    public theme: ThemeService,
    public sync: SyncService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    this.user = this.auth.getUser();
  }

  async onRefresh(): Promise<void> {
    // isSyncing est muté dans un contexte async (await sort de NgZone sur certains navigateurs).
    // NgZone.run() garantit que les mutations sont vues par Angular et déclenchent le re-render.
    this.ngZone.run(() => { this.isSyncing = true; this.cdr.markForCheck(); });
    try {
      const tenantId = this.auth.getTenantId();
      const ok = await this.offline.syncProduitsFromServer(tenantId);
      this.ngZone.run(() => {
        this.isSyncing = false;
        this.cdr.markForCheck();
        if (ok) this.snackBar.open('Catalogue mis à jour', 'Fermer', { duration: 3000 });
        else this.snackBar.open('Aucune modification', 'Fermer', { duration: 3000 });
      });
    } catch (err) {
      this.ngZone.run(() => {
        this.isSyncing = false;
        this.cdr.markForCheck();
        this.snackBar.open('Erreur de synchronisation', 'Fermer', { duration: 3000 });
      });
      console.error('Erreur syncProduitsFromServer (manuelle):', err);
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
