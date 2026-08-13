import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SyncService } from '../../../core/services/sync.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ClientsService } from '../../../core/services/clients.service';
import { AbonnementService } from '../../../core/services/abonnement.service';

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
      <button mat-icon-button (click)="theme.toggle()" style="color:var(--text-2)" [title]="theme.isDark() ? 'Mode clair' : 'Mode sombre'">
        <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
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

    <!-- Bandeau abonnement SaaS : discret, informatif, jamais bloquant -->
    <div class="abo-banner" [class.retard]="abonnement.statut()?.statut === 'en_retard'"
      [class.stacked]="sync.afficherBandeau()"
      *ngIf="abonnement.statut()?.alerte && !abonnement.bandeauFerme()">
      <mat-icon>event_available</mat-icon>
      <span *ngIf="abonnement.statut()?.statut === 'a_venir'">
        Ton abonnement SmartStock arrive à échéance dans {{ abonnement.statut()?.joursRestants }} jour(s) — pense à renouveler.
      </span>
      <span *ngIf="abonnement.statut()?.statut === 'en_retard'">
        Ton abonnement SmartStock est en retard de {{ -(abonnement.statut()?.joursRestants ?? 0) }} jour(s) — contacte-nous pour régulariser.
      </span>
      <button class="abo-close" (click)="abonnement.fermerBandeau()"><mat-icon>close</mat-icon></button>
    </div>

    <main class="main-content" [class.with-banner]="sync.afficherBandeau()"
      [class.with-abo-banner]="abonnement.statut()?.alerte && !abonnement.bandeauFerme()">
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
      <a routerLink="/patron/relances" routerLinkActive="active" class="relances-link">
        <span class="relances-badge" *ngIf="clients.relancesCount() > 0">{{ clients.relancesCount() }}</span>
        <mat-icon>notifications</mat-icon>
        <span>Relances</span>
      </a>
    </nav>
  `,
  styles: [`
    .topbar {
      background: var(--navy-light, rgba(15,27,45,.85));
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

    .abo-banner {
      position: fixed;
      top: calc(var(--safe-top) + var(--topbar-h));
      left: 0; right: 0;
      z-index: 98;
      background: rgba(52,152,219,.12);
      border-bottom: 1px solid rgba(52,152,219,.25);
      color: #74b9ff;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    /* Stacked : le bandeau sync est déjà affiché au-dessus, donc on se pose en dessous */
    .abo-banner.stacked { top: calc(var(--safe-top) + var(--topbar-h) + 33px); }
    .abo-banner.retard { background: rgba(231,76,60,.12); border-color: rgba(231,76,60,.3); color: #e74c3c; }
    .abo-banner mat-icon:first-child { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .abo-close {
      margin-left: auto;
      background: transparent; border: none; color: inherit; cursor: pointer;
      display: flex; align-items: center; padding: 2px;
    }
    .abo-close mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .main-content {
      position: fixed;
      top: calc(var(--safe-top) + var(--topbar-h));
      bottom: calc(var(--safe-bot) + var(--nav-h));
      left: 0;
      right: 0;
      overflow-y: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
      background: var(--navy);
      padding: 16px;
    }
    .main-content.with-banner { top: calc(var(--safe-top) + var(--topbar-h) + 33px); }
    .main-content.with-abo-banner { top: calc(var(--safe-top) + var(--topbar-h) + 33px); }
    .main-content.with-banner.with-abo-banner { top: calc(var(--safe-top) + var(--topbar-h) + 66px); }

    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(var(--nav-h) + var(--safe-bot));
      /* Avant : padding-bottom: var(--safe-bot) poussait toute la safe-area
         en bande vide sous les icônes (grid stretch remplit nav-h, le padding
         mange le reste) — visuellement une bande "morte" collée en bas, gâchis
         d'espace comparé à Android qui n'a pas cette zone. Fix : pas de padding,
         on laisse les items grid s'étirer sur la hauteur totale (nav-h + safe-bot)
         et on centre leur contenu verticalement dedans (voir .bottom-nav a),
         donc l'espace de la safe-area est réparti au lieu d'être mort en bas. */
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
    .bottom-nav a.active { color: var(--accent); }
    .relances-link { position: relative; }
    .relances-badge {
      position: absolute;
      top: 2px;
      right: calc(50% - 20px);
      background: #e74c3c;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      min-width: 15px;
      height: 15px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      line-height: 1;
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
  `]
})
export class PatronLayoutComponent {
  user: any;

  constructor(
    private auth: AuthService,
    public sync: SyncService,
    public theme: ThemeService,
    public clients: ClientsService,
    public abonnement: AbonnementService,
    private router: Router,
  ) {
    this.user = this.auth.getUser();
    this.clients.rafraichirRelances();
    this.abonnement.rafraichir();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
