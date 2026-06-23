import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

interface PatronUser {
  _id: string;
  nom: string;
  email: string;
  boutique?: string;
  tenantId: string;
  actif: boolean;
  role?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="admin-page">
      <!-- Auth gate -->
      <div class="auth-gate" *ngIf="!adminKey">
        <div class="auth-card">
          <mat-icon class="auth-icon">admin_panel_settings</mat-icon>
          <h1>Administration SmartStock</h1>
          <p>Saisissez la clé admin pour continuer</p>
          <input
            type="password"
            class="key-input"
            placeholder="Clé admin (x-admin-key)"
            [(ngModel)]="keyInput"
            (keyup.enter)="connect()"
          />
          <div class="error" *ngIf="authError">{{ authError }}</div>
          <button class="btn-primary" (click)="connect()">Se connecter</button>
        </div>
      </div>

      <!-- Main admin UI -->
      <ng-container *ngIf="adminKey">
        <div class="topbar">
          <mat-icon>admin_panel_settings</mat-icon>
          <span class="app-title">Administration SmartStock</span>
          <span class="spacer"></span>
          <button class="btn-ghost" (click)="logout()">
            <mat-icon>logout</mat-icon> Déconnexion
          </button>
        </div>

        <div class="content">
          <!-- Stats -->
          <div class="stats-grid" *ngIf="stats">
            <div class="stat-card" style="--glow:#00b894">
              <mat-icon>store</mat-icon>
              <div>
                <div class="stat-value">{{ stats.totalPatrons }}</div>
                <div class="stat-label">Total patrons</div>
              </div>
            </div>
            <div class="stat-card" style="--glow:#0984e3">
              <mat-icon>check_circle</mat-icon>
              <div>
                <div class="stat-value">{{ stats.actifs }}</div>
                <div class="stat-label">Actifs</div>
              </div>
            </div>
            <div class="stat-card" style="--glow:#e74c3c">
              <mat-icon>cancel</mat-icon>
              <div>
                <div class="stat-value">{{ stats.inactifs }}</div>
                <div class="stat-label">Inactifs</div>
              </div>
            </div>
          </div>

          <div class="section-header">
            <span class="section-title">Patrons</span>
            <button class="btn-primary small" (click)="showCreate = !showCreate">
              <mat-icon>add</mat-icon> Nouveau patron
            </button>
          </div>

          <!-- Create form -->
          <div class="create-card" *ngIf="showCreate">
            <div class="form-row">
              <input class="field" placeholder="Nom" [(ngModel)]="newUser.nom" />
              <input class="field" placeholder="Boutique" [(ngModel)]="newUser.boutique" />
            </div>
            <div class="form-row">
              <input class="field" placeholder="Email" type="email" [(ngModel)]="newUser.email" />
              <input class="field" placeholder="Mot de passe" type="password" [(ngModel)]="newUser.password" />
            </div>
            <div class="error" *ngIf="createError">{{ createError }}</div>
            <div class="form-actions">
              <button class="btn-ghost" (click)="showCreate = false">Annuler</button>
              <button class="btn-primary" (click)="createPatron()" [disabled]="creating">
                {{ creating ? 'Création...' : 'Créer' }}
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div class="loading" *ngIf="loading">Chargement...</div>

          <!-- List -->
          <div class="user-list" *ngIf="!loading">
            <div class="empty" *ngIf="users.length === 0">Aucun patron enregistré</div>
            <div class="user-card" *ngFor="let u of users">
              <div class="user-avatar" [class.inactive]="!u.actif">{{ initiale(u.nom) }}</div>
              <div class="user-info">
                <div class="user-name">
                  {{ u.nom }}
                  <span class="badge" [class.on]="u.actif">{{ u.actif ? 'Actif' : 'Inactif' }}</span>
                </div>
                <div class="user-meta">{{ u.email }} · {{ u.boutique || '—' }}</div>
                <div class="user-tenant">tenantId: {{ u.tenantId }}</div>
              </div>
              <div class="user-actions">
                <button class="icon-btn" title="Voir l'équipe (boutique)" (click)="openTeam(u)">
                  <mat-icon>groups</mat-icon>
                </button>
                <button class="icon-btn" title="Modifier nom/email" (click)="openEdit(u)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button class="icon-btn" title="Activer/désactiver" (click)="toggle(u)">
                  <mat-icon>{{ u.actif ? 'toggle_on' : 'toggle_off' }}</mat-icon>
                </button>
                <button class="icon-btn" title="Réinitialiser mot de passe" (click)="openReset(u)">
                  <mat-icon>key</mat-icon>
                </button>
                <button class="icon-btn danger" title="Supprimer" (click)="remove(u)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Reset password modal -->
        <div class="modal-overlay" *ngIf="resetTarget" (click)="resetTarget = null">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>Réinitialiser le mot de passe</h3>
            <p class="modal-sub">{{ resetTarget.nom }} ({{ resetTarget.email }})</p>
            <input class="field" type="password" placeholder="Nouveau mot de passe (min 6)" [(ngModel)]="newPassword" />
            <div class="error" *ngIf="resetError">{{ resetError }}</div>
            <div class="form-actions">
              <button class="btn-ghost" (click)="resetTarget = null">Annuler</button>
              <button class="btn-primary" (click)="confirmReset()">Confirmer</button>
            </div>
          </div>
        </div>

        <!-- Edit modal (nom / email / boutique) -->
        <div class="modal-overlay" *ngIf="editTarget" (click)="editTarget = null">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>Modifier le compte</h3>
            <p class="modal-sub">tenantId: {{ editTarget.tenantId }}</p>
            <input class="field" placeholder="Nom" [(ngModel)]="editForm.nom" />
            <input class="field" placeholder="Email" type="email" [(ngModel)]="editForm.email" />
            <input class="field" placeholder="Boutique" [(ngModel)]="editForm.boutique" />
            <div class="error" *ngIf="editError">{{ editError }}</div>
            <div class="form-actions">
              <button class="btn-ghost" (click)="editTarget = null">Annuler</button>
              <button class="btn-primary" (click)="confirmEdit()">Enregistrer</button>
            </div>
          </div>
        </div>

        <!-- Team modal (patron + agents d'une boutique) -->
        <div class="modal-overlay" *ngIf="teamTarget" (click)="closeTeam()">
          <div class="modal-card team-card" (click)="$event.stopPropagation()">
            <h3>Équipe — {{ teamTarget.boutique || teamTarget.nom }}</h3>
            <p class="modal-sub">tenantId: {{ teamTarget.tenantId }}</p>
            <div class="loading" *ngIf="teamLoading">Chargement...</div>
            <div class="team-list" *ngIf="!teamLoading">
              <div class="team-row" *ngFor="let m of team">
                <div class="team-avatar" [class.inactive]="!m.actif">{{ initiale(m.nom) }}</div>
                <div class="team-info">
                  <div class="team-name">
                    {{ m.nom }}
                    <span class="role-badge" [class.patron]="m.role === 'patron'">{{ m.role }}</span>
                  </div>
                  <div class="team-email">{{ m.email }}</div>
                </div>
                <div class="team-actions">
                  <button class="icon-btn" title="Modifier" (click)="openEdit(m)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button class="icon-btn" title="Activer/désactiver" (click)="toggle(m)">
                    <mat-icon>{{ m.actif ? 'toggle_on' : 'toggle_off' }}</mat-icon>
                  </button>
                  <button class="icon-btn" title="Réinitialiser mot de passe" (click)="openReset(m)">
                    <mat-icon>key</mat-icon>
                  </button>
                  <button class="icon-btn danger" title="Supprimer" *ngIf="m.role !== 'patron'" (click)="removeFromTeam(m)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn-ghost" (click)="closeTeam()">Fermer</button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .admin-page { min-height: 100dvh; background: var(--navy); color: var(--text-1); }

    /* Auth gate */
    .auth-gate { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .auth-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 18px;
      padding: 32px 28px;
      max-width: 380px;
      width: 100%;
      text-align: center;
    }
    .auth-icon { color: var(--accent); font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }
    .auth-card h1 { font-size: 18px; margin: 8px 0 4px; }
    .auth-card p { color: var(--text-3); font-size: 13px; margin-bottom: 16px; }
    .key-input {
      width: 100%;
      background: var(--navy-light);
      border: 1px solid var(--navy-border);
      border-radius: 10px;
      padding: 12px 14px;
      color: var(--text-1);
      font-size: 14px;
      margin-bottom: 12px;
      box-sizing: border-box;
    }
    .key-input:focus { outline: none; border-color: var(--accent); }

    .btn-primary {
      background: var(--accent);
      color: #06281f;
      border: none;
      border-radius: 10px;
      padding: 11px 18px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-primary.small { width: auto; padding: 8px 14px; }
    .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
    .btn-ghost {
      background: transparent;
      border: 1px solid var(--navy-border);
      color: var(--text-2);
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .error { color: var(--danger); font-size: 12px; margin-bottom: 8px; }

    /* Topbar */
    .topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 20px;
      background: rgba(15,27,45,.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--navy-border);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .topbar mat-icon { color: var(--accent); }
    .app-title { font-weight: 700; font-size: 15px; }
    .spacer { flex: 1; }

    .content { max-width: 800px; margin: 0 auto; padding: 20px; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
    .stat-card {
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 14px;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .stat-card mat-icon { color: var(--glow); }
    .stat-value { font-size: 18px; font-weight: 800; }
    .stat-label { font-size: 11px; color: var(--text-3); }

    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .section-title { font-size: 12px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: var(--text-3); }

    /* Create form */
    .create-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .form-row { display: flex; gap: 10px; margin-bottom: 10px; }
    .field {
      flex: 1;
      background: var(--navy-light);
      border: 1px solid var(--navy-border);
      border-radius: 8px;
      padding: 10px 12px;
      color: var(--text-1);
      font-size: 13px;
      box-sizing: border-box;
    }
    .field:focus { outline: none; border-color: var(--accent); }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

    .loading, .empty { color: var(--text-3); text-align: center; padding: 24px; font-size: 13px; }

    /* User list */
    .user-list { display: flex; flex-direction: column; gap: 10px; }
    .user-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 14px;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .user-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--accent-lite); border: 2px solid var(--accent); color: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 15px; flex-shrink: 0;
    }
    .user-avatar.inactive { border-color: var(--text-3); color: var(--text-3); background: rgba(255,255,255,.04); }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .user-meta { color: var(--text-2); font-size: 12px; margin-top: 2px; }
    .user-tenant { color: var(--text-3); font-size: 11px; margin-top: 2px; }
    .badge {
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
      background: rgba(255,255,255,.06); color: var(--text-3);
    }
    .badge.on { background: var(--accent-lite); color: var(--accent); }
    .user-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .icon-btn {
      background: transparent; border: none; color: var(--text-3); cursor: pointer;
      padding: 6px; border-radius: 8px; display: flex;
    }
    .icon-btn:hover { background: rgba(255,255,255,.06); color: var(--text-1); }
    .icon-btn.danger:hover { color: var(--danger); }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
    }
    .modal-card {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 16px; padding: 22px; max-width: 360px; width: 100%;
    }
    .modal-card h3 { margin: 0 0 4px; font-size: 15px; }
    .modal-sub { color: var(--text-3); font-size: 12px; margin-bottom: 14px; }

    /* Team modal */
    .team-card { max-width: 480px; }
    .team-list { display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow-y: auto; margin-bottom: 14px; }
    .team-row {
      background: var(--navy-light); border: 1px solid var(--navy-border);
      border-radius: 12px; padding: 10px 12px;
      display: flex; align-items: center; gap: 10px;
    }
    .team-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--accent-lite); border: 2px solid var(--accent); color: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; flex-shrink: 0;
    }
    .team-avatar.inactive { border-color: var(--text-3); color: var(--text-3); background: rgba(255,255,255,.04); }
    .team-info { flex: 1; min-width: 0; }
    .team-name { font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .team-email { color: var(--text-3); font-size: 11px; margin-top: 1px; }
    .role-badge {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      padding: 2px 7px; border-radius: 20px;
      background: rgba(255,255,255,.06); color: var(--text-3);
    }
    .role-badge.patron { background: var(--accent-lite); color: var(--accent); }
    .team-actions { display: flex; gap: 2px; flex-shrink: 0; }
  `]
})
export class AdminComponent implements OnInit {
  adminKey: string | null = null;
  keyInput = '';
  authError = '';

  stats: { totalPatrons: number; actifs: number; inactifs: number } | null = null;
  users: PatronUser[] = [];
  loading = false;

  showCreate = false;
  creating = false;
  createError = '';
  newUser = { nom: '', email: '', password: '', boutique: '' };

  resetTarget: PatronUser | null = null;
  newPassword = '';
  resetError = '';

  editTarget: PatronUser | null = null;
  editForm = { nom: '', email: '', boutique: '' };
  editError = '';

  teamTarget: PatronUser | null = null;
  team: PatronUser[] = [];
  teamLoading = false;

  private base = environment.apiUrl.replace(/\/+$/, '').replace(/\/api$/, '') + '/api/admin';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const stored = sessionStorage.getItem('ss_admin_key');
    if (stored) {
      this.adminKey = stored;
      this.loadAll();
    }
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'x-admin-key': this.adminKey || '' });
  }

  connect(): void {
    if (!this.keyInput.trim()) return;
    this.authError = '';
    const testKey = this.keyInput.trim();
    this.http
      .get(`${this.base}/stats`, { headers: new HttpHeaders({ 'x-admin-key': testKey }) })
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        if (res?.success) {
          this.adminKey = testKey;
          sessionStorage.setItem('ss_admin_key', testKey);
          this.loadAll();
        } else {
          this.authError = 'Clé admin invalide';
        }
      });
  }

  logout(): void {
    this.adminKey = null;
    this.keyInput = '';
    sessionStorage.removeItem('ss_admin_key');
  }

  loadAll(): void {
    this.loading = true;
    this.http.get(`${this.base}/stats`, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => { if (res?.success) this.stats = res.data; });

    this.http.get(`${this.base}/users`, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        this.loading = false;
        if (res?.success) this.users = res.data;
      });
  }

  initiale(nom: string): string {
    return (nom || '?').charAt(0).toUpperCase();
  }

  createPatron(): void {
    this.createError = '';
    if (!this.newUser.nom || !this.newUser.email || !this.newUser.password) {
      this.createError = 'Nom, email et mot de passe requis';
      return;
    }
    this.creating = true;
    this.http.post(`${this.base}/users`, this.newUser, { headers: this.headers() })
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message || 'Erreur' })))
      .subscribe((res: any) => {
        this.creating = false;
        if (res?.success) {
          this.showCreate = false;
          this.newUser = { nom: '', email: '', password: '', boutique: '' };
          this.loadAll();
        } else {
          this.createError = res?.message || 'Erreur lors de la création';
        }
      });
  }

  toggle(u: PatronUser): void {
    this.http.patch(`${this.base}/users/${u._id}/toggle`, {}, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        if (res?.success) this.patchLocal(u._id, { actif: res.data.actif });
      });
  }

  openReset(u: PatronUser): void {
    this.resetTarget = u;
    this.newPassword = '';
    this.resetError = '';
  }

  confirmReset(): void {
    if (!this.resetTarget) return;
    if (!this.newPassword || this.newPassword.length < 6) {
      this.resetError = 'Minimum 6 caractères';
      return;
    }
    this.http.patch(`${this.base}/users/${this.resetTarget._id}/reset-password`,
      { newPassword: this.newPassword }, { headers: this.headers() })
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })))
      .subscribe((res: any) => {
        if (res?.success) {
          this.resetTarget = null;
        } else {
          this.resetError = res?.message || 'Erreur';
        }
      });
  }

  openEdit(u: PatronUser): void {
    this.editTarget = u;
    this.editForm = { nom: u.nom, email: u.email, boutique: u.boutique || '' };
    this.editError = '';
  }

  confirmEdit(): void {
    if (!this.editTarget) return;
    if (!this.editForm.nom || !this.editForm.email) {
      this.editError = 'Nom et email requis';
      return;
    }
    this.http.patch(`${this.base}/users/${this.editTarget._id}`, this.editForm, { headers: this.headers() })
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })))
      .subscribe((res: any) => {
        if (res?.success) {
          this.patchLocal(this.editTarget!._id, res.data);
          this.editTarget = null;
        } else {
          this.editError = res?.message || 'Erreur';
        }
      });
  }

  openTeam(u: PatronUser): void {
    this.teamTarget = u;
    this.team = [];
    this.teamLoading = true;
    this.http.get(`${this.base}/tenants/${u.tenantId}/team`, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        this.teamLoading = false;
        if (res?.success) this.team = res.data;
      });
  }

  closeTeam(): void {
    this.teamTarget = null;
    this.team = [];
  }

  removeFromTeam(m: PatronUser): void {
    if (!confirm(`Supprimer le compte de ${m.nom} ?`)) return;
    this.http.delete(`${this.base}/users/${m._id}`, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        if (res?.success) this.team = this.team.filter(x => x._id !== m._id);
      });
  }

  /** Met à jour l'objet correspondant dans this.users ET this.team (l'un des deux peut etre absent) */
  private patchLocal(id: string, patch: Partial<PatronUser>): void {
    const u1 = this.users.find(x => x._id === id);
    if (u1) Object.assign(u1, patch);
    const u2 = this.team.find(x => x._id === id);
    if (u2) Object.assign(u2, patch);
  }

  remove(u: PatronUser): void {
    if (!confirm(`Supprimer le compte de ${u.nom} ?`)) return;
    this.http.delete(`${this.base}/users/${u._id}`, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        if (res?.success) this.users = this.users.filter(x => x._id !== u._id);
      });
  }
}
