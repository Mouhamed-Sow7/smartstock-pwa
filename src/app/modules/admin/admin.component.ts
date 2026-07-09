import { Component, OnInit, ChangeDetectorRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

interface Patron { _id: string; nom: string; email: string; telephone?: string; boutique?: string; tenantId: string; actif: boolean; }
interface Agent  { _id: string; nom: string; prenom?: string; email?: string; telephone?: string; actif: boolean; }

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
<div class="adm">

  <!-- Topbar fixe -->
  <header class="adm-bar">
    <div class="adm-brand"><mat-icon>admin_panel_settings</mat-icon>SmartStock Admin</div>
    <div class="adm-bar-right" *ngIf="ok()">
      <span class="env-pill">{{ isProd ? 'Production' : 'Dev' }}</span>
      <button class="adm-logout" (click)="logout()"><mat-icon>logout</mat-icon></button>
    </div>
  </header>

  <!-- Auth gate -->
  <div class="adm-gate" *ngIf="!ok()">
    <div class="gate-card">
      <mat-icon class="gate-ico">lock</mat-icon>
      <h2>Administration</h2>
      <p>Clé d'accès requise</p>
      <input class="adm-inp" type="password" [(ngModel)]="keyInput"
        placeholder="Clé admin" (keyup.enter)="connect()" [disabled]="authBusy" />
      <div class="err-msg" *ngIf="authErr"><mat-icon>error_outline</mat-icon>{{ authErr }}</div>
      <button class="btn-primary w100" (click)="connect()" [disabled]="authBusy || !keyInput.trim()">
        <mat-icon>{{ authBusy ? 'hourglass_empty' : 'login' }}</mat-icon>
        {{ authBusy ? 'Vérification…' : 'Se connecter' }}
      </button>
    </div>
  </div>

  <!-- Corps principal scrollable -->
  <div class="adm-body" *ngIf="ok()">

    <!-- KPIs -->
    <div class="kpis" *ngIf="stats()">
      <div class="kpi green"><mat-icon>people</mat-icon><b>{{ stats()!.totalPatrons }}</b><span>Patrons</span></div>
      <div class="kpi teal"><mat-icon>check_circle</mat-icon><b>{{ stats()!.actifs }}</b><span>Actifs</span></div>
      <div class="kpi red"><mat-icon>block</mat-icon><b>{{ stats()!.inactifs }}</b><span>Inactifs</span></div>
      <div class="kpi blue"><mat-icon>badge</mat-icon><b>{{ stats()!.totalAgents ?? 0 }}</b><span>Agents</span></div>
      <div class="kpi purple"><mat-icon>receipt_long</mat-icon><b>{{ stats()!.ventes30j ?? 0 }}</b><span>Ventes 30j</span></div>
      <div class="kpi amber"><mat-icon>trending_up</mat-icon><b>{{ (stats()!.ca30j ?? 0) | number:'1.0-0' }}</b><span>CA 30j</span></div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" [class.on]="tab==='patrons'" (click)="tab='patrons'"><mat-icon>storefront</mat-icon>Patrons</button>
      <button class="tab" [class.on]="tab==='creer'"   (click)="tab='creer'"  ><mat-icon>person_add</mat-icon>Créer</button>
      <button class="tab" [class.on]="tab==='outils'"  (click)="tab='outils'" ><mat-icon>build</mat-icon>Outils</button>
    </div>

    <!-- ── PATRONS ── -->
    <section *ngIf="tab==='patrons'">
      <div class="sec-head">
        <h3>Patrons ({{ patronsFiltres().length }}/{{ patrons().length }})</h3>
        <button class="btn-ico" (click)="loadAll()" title="Rafraîchir">
          <mat-icon [class.spin]="loading()">refresh</mat-icon>
        </button>
      </div>
      <input class="adm-inp search" type="text" [(ngModel)]="q" placeholder="Rechercher…" />

      <div class="adm-list" *ngIf="!loading() || patrons().length">
        <div class="patron-row" *ngFor="let p of patronsFiltres()">
          <div class="p-avatar">{{ (p.nom||'?')[0].toUpperCase() }}</div>
          <div class="p-info">
            <div class="p-nom">{{ p.nom }}</div>
            <div class="p-email">{{ p.email }}</div>
            <div class="p-meta">{{ p.boutique || '—' }} · <span class="tenant">{{ p.tenantId }}</span></div>
          </div>
          <div class="p-actions">
            <!-- Toggle robuste : désactivé pendant l'appel, rollback si erreur -->
            <button class="toggle-btn" [class.on]="p.actif" [disabled]="toggling[p._id]"
              (click)="togglePatron(p)" [title]="p.actif ? 'Désactiver' : 'Activer'">
              <mat-icon>{{ toggling[p._id] ? 'hourglass_empty' : (p.actif ? 'toggle_on' : 'toggle_off') }}</mat-icon>
            </button>
            <button class="btn-ico" title="Modifier" (click)="openEdit(p)"><mat-icon>edit</mat-icon></button>
            <button class="btn-ico" title="Équipe" (click)="toggleEquipe(p)"><mat-icon>group</mat-icon></button>
            <button class="btn-ico danger" title="Supprimer" (click)="deletePatron(p)"><mat-icon>delete</mat-icon></button>
          </div>

          <!-- Équipe inline -->
          <div class="equipe" *ngIf="equipeOuvert===p._id">
            <div class="eq-loading" *ngIf="equipeLoading"><mat-icon class="spin">autorenew</mat-icon>Chargement…</div>
            <div class="eq-vide" *ngIf="!equipeLoading && equipe.length===0">Aucun agent</div>
            <div class="eq-row" *ngFor="let a of equipe">
              <mat-icon>person</mat-icon>
              <span>{{ a.prenom||'' }} {{ a.nom }}</span>
              <span class="eq-contact">{{ a.telephone || a.email || '' }}</span>
              <span class="pill" [class.on]="a.actif">{{ a.actif?'Actif':'Inactif' }}</span>
            </div>
          </div>
        </div>
        <div class="empty" *ngIf="!loading() && patronsFiltres().length===0">
          <mat-icon>people_outline</mat-icon><p>Aucun patron</p>
        </div>
      </div>
      <div class="adm-loading" *ngIf="loading() && !patrons().length">
        <mat-icon class="spin">autorenew</mat-icon> Chargement…
      </div>
    </section>

    <!-- ── CRÉER ── -->
    <section *ngIf="tab==='creer'">
      <h3>Nouveau patron</h3>
      <div class="form-card">
        <div class="f-row">
          <div class="f-grp"><label>Nom *</label><input class="adm-inp" [(ngModel)]="nv.nom" placeholder="Moussa Diop" /></div>
          <div class="f-grp"><label>Boutique *</label><input class="adm-inp" [(ngModel)]="nv.boutique" placeholder="Épicerie Al Amine" /></div>
        </div>
        <div class="f-row">
          <div class="f-grp"><label>Email *</label><input class="adm-inp" type="email" [(ngModel)]="nv.email" placeholder="patron@boutique.com" /></div>
          <div class="f-grp"><label>Téléphone</label><input class="adm-inp" [(ngModel)]="nv.telephone" placeholder="77 123 45 67" /></div>
        </div>
        <div class="f-grp"><label>Mot de passe (vide = auto-généré)</label><input class="adm-inp" type="password" [(ngModel)]="nv.password" placeholder="••••••••" /></div>
        <div class="ok-msg" *ngIf="nvOk"><mat-icon>check_circle</mat-icon><div><b>{{ nvOk.nom }}</b> créé<br/><span *ngIf="nvOk.mdp">Mdp : <b>{{ nvOk.mdp }}</b> <em>(à communiquer, non récupérable)</em></span></div></div>
        <div class="err-msg" *ngIf="nvErr"><mat-icon>error_outline</mat-icon>{{ nvErr }}</div>
        <button class="btn-primary" (click)="creerPatron()" [disabled]="nvBusy || !nv.nom || !nv.boutique || !nv.email">
          <mat-icon>{{ nvBusy ? 'hourglass_empty' : 'person_add' }}</mat-icon>
          {{ nvBusy ? 'Création…' : 'Créer le patron' }}
        </button>
      </div>
    </section>

    <!-- ── OUTILS ── -->
    <section *ngIf="tab==='outils'">
      <h3>Outils</h3>

      <div class="tool-card">
        <h4><mat-icon>key</mat-icon>Reset mot de passe par email</h4>
        <p>Laissez le champ vide pour générer automatiquement</p>
        <div class="f-row">
          <input class="adm-inp" [(ngModel)]="resetMail" placeholder="Email" style="flex:2"/>
          <input class="adm-inp" [(ngModel)]="resetPass" placeholder="Nouveau mdp (optionnel)" style="flex:1"/>
          <button class="btn-primary" (click)="resetByEmail()" [disabled]="resetBusy || !resetMail.trim()">{{ resetBusy?'…':'Réinitialiser' }}</button>
        </div>
        <div class="err-msg" *ngIf="resetErr"><mat-icon>error_outline</mat-icon>{{ resetErr }}</div>
        <div class="ok-msg"  *ngIf="resetOk" ><mat-icon>check_circle</mat-icon>{{ resetOk }}</div>
      </div>

      <div class="tool-card danger-zone">
        <h4><mat-icon>delete_forever</mat-icon>Purge des ventes</h4>
        <p>Supprime toutes les ventes. Action irréversible.</p>
        <button class="btn-danger" (click)="purgerVentes()" [disabled]="purgeBusy">
          <mat-icon>{{ purgeBusy ? 'hourglass_empty' : 'warning' }}</mat-icon>{{ purgeBusy?'Purge…':'Purger toutes les ventes' }}
        </button>
        <div class="ok-msg"  *ngIf="purgeOk" ><mat-icon>check_circle</mat-icon>{{ purgeOk }}</div>
        <div class="err-msg" *ngIf="purgeErr"><mat-icon>error_outline</mat-icon>{{ purgeErr }}</div>
      </div>
    </section>

  </div><!-- /adm-body -->

  <!-- Modal édition -->
  <div class="overlay" *ngIf="editP" (click)="$event.target===$event.currentTarget && closeEdit()">
    <div class="modal">
      <div class="modal-head"><h3>Modifier le patron</h3><button class="btn-ico" (click)="closeEdit()"><mat-icon>close</mat-icon></button></div>
      <div class="f-grp"><label>Nom</label><input class="adm-inp" [(ngModel)]="editF.nom"/></div>
      <div class="f-grp"><label>Email</label><input class="adm-inp" [(ngModel)]="editF.email"/></div>
      <div class="f-grp"><label>Boutique</label><input class="adm-inp" [(ngModel)]="editF.boutique"/></div>
      <div class="err-msg" *ngIf="editErr"><mat-icon>error_outline</mat-icon>{{ editErr }}</div>
      <div class="modal-foot">
        <button class="btn-ghost" (click)="closeEdit()">Annuler</button>
        <button class="btn-primary" (click)="saveEdit()" [disabled]="editBusy"><mat-icon>save</mat-icon>{{ editBusy?'…':'Enregistrer' }}</button>
      </div>
    </div>
  </div>

</div>
  `,
  styles: [`
    /* Host element : contraindre à 100vh pour que flex fonctionne */
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      background: #0a1628;
    }

    /* Reset & base */
    *{box-sizing:border-box;margin:0;padding:0}
    .adm{
      display:contents; /* laisse :host gérer le layout */
    }

    /* Topbar fixe */
    .adm-bar{
      position:sticky;top:0;z-index:200;
      display:flex;align-items:center;gap:10px;
      height:52px;padding:0 20px;
      background:#0f1b2d;border-bottom:1px solid rgba(255,255,255,.07);
      flex-shrink:0;
    }
    .adm-brand{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#00b894;}
    .adm-brand mat-icon{font-size:20px;}
    .adm-bar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
    .env-pill{background:rgba(0,184,148,.15);color:#00b894;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
    .adm-logout{background:rgba(231,76,60,.12);border:1px solid rgba(231,76,60,.3);color:#e74c3c;border-radius:8px;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;}

    /* Auth gate */
    .adm-gate{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;}
    .gate-card{background:#0f1b2d;border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:36px 28px;width:100%;max-width:380px;text-align:center;display:flex;flex-direction:column;gap:12px;}
    .gate-ico{font-size:44px;width:44px;height:44px;color:#00b894;margin:0 auto 4px;}
    .gate-card h2{font-size:20px;font-weight:700;}
    .gate-card p{font-size:13px;color:#4a5568;}

    /* Corps scrollable */
    .adm-body{
      flex:1;overflow-y:auto;
      -webkit-overflow-scrolling:touch;
      padding:20px 16px 40px;
      max-width:1000px;width:100%;margin:0 auto;
    }

    /* KPIs */
    .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:24px;}
    @media(max-width:700px){.kpis{grid-template-columns:repeat(3,1fr);}}
    @media(max-width:420px){.kpis{grid-template-columns:repeat(2,1fr);}}
    .kpi{background:#0f1b2d;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 10px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;}
    .kpi mat-icon{font-size:22px;margin-bottom:2px;}
    .kpi b{font-size:20px;font-weight:800;color:#e8eaf0;}
    .kpi span{font-size:10px;color:#4a5568;}
    .kpi.green mat-icon{color:#00b894;} .kpi.teal mat-icon{color:#00cec9;}
    .kpi.red mat-icon{color:#e74c3c;} .kpi.blue mat-icon{color:#74b9ff;}
    .kpi.purple mat-icon{color:#a29bfe;} .kpi.amber mat-icon{color:#fdcb6e;}

    /* Tabs */
    .tabs{display:flex;gap:4px;background:#0f1b2d;border-radius:12px;padding:4px;margin-bottom:20px;}
    .tab{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 6px;border:none;background:transparent;color:#8892a4;border-radius:9px;cursor:pointer;font-size:12px;font-weight:600;transition:.15s;}
    .tab mat-icon{font-size:15px;width:15px;height:15px;}
    .tab.on{background:#14243d;color:#00b894;}

    /* Section header */
    .sec-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
    .sec-head h3{flex:1;font-size:15px;font-weight:700;color:#e8eaf0;}

    /* Search */
    .adm-inp.search{width:100%;margin-bottom:12px;}

    /* Liste patrons */
    .adm-list{display:flex;flex-direction:column;gap:8px;}
    .patron-row{
      background:#0f1b2d;border:1px solid rgba(255,255,255,.07);
      border-radius:14px;padding:14px;
      display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;
    }
    .p-avatar{width:38px;height:38px;border-radius:10px;background:rgba(0,184,148,.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#00b894;flex-shrink:0;}
    .p-nom{font-size:14px;font-weight:600;color:#e8eaf0;}
    .p-email{font-size:12px;color:#8892a4;margin-top:1px;}
    .p-meta{font-size:11px;color:#4a5568;margin-top:2px;}
    .tenant{font-family:monospace;font-size:10px;}
    .p-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;}

    /* Équipe inline — pleine largeur sous les 3 colonnes */
    .equipe{grid-column:1/-1;background:rgba(255,255,255,.03);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;}
    .eq-loading,.eq-vide{display:flex;align-items:center;gap:6px;font-size:12px;color:#8892a4;padding:4px 0;}
    .eq-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#8892a4;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);}
    .eq-row:last-child{border-bottom:none;}
    .eq-row mat-icon{font-size:15px;color:#4a5568;}
    .eq-contact{font-size:11px;color:#4a5568;flex:1;}

    /* Toggle robuste */
    .toggle-btn{
      display:flex;align-items:center;justify-content:center;
      width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.1);
      background:rgba(231,76,60,.1);color:#e74c3c;cursor:pointer;
      transition:all .2s;
    }
    .toggle-btn.on{background:rgba(0,184,148,.12);border-color:rgba(0,184,148,.25);color:#00b894;}
    .toggle-btn:disabled{opacity:.5;cursor:not-allowed;}
    .toggle-btn mat-icon{font-size:20px;width:20px;height:20px;}

    /* Inputs */
    .adm-inp{
      width:100%;padding:10px 12px;
      background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
      border-radius:10px;color:#e8eaf0;font-size:14px;outline:none;
      transition:border-color .15s;
    }
    .adm-inp:focus{border-color:#00b894;}
    .adm-inp::placeholder{color:#4a5568;}

    /* Boutons */
    .btn-primary{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;background:#00b894;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .15s;}
    .btn-primary:hover:not(:disabled){opacity:.88;}
    .btn-primary:disabled{opacity:.5;cursor:not-allowed;}
    .btn-primary.w100{width:100%;justify-content:center;padding:13px;}
    .btn-ghost{padding:10px 18px;background:transparent;color:#8892a4;border:1px solid rgba(255,255,255,.1);border-radius:10px;font-size:14px;cursor:pointer;}
    .btn-ico{width:32px;height:32px;border-radius:8px;border:none;background:rgba(255,255,255,.05);color:#8892a4;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
    .btn-ico:hover{background:rgba(255,255,255,.12);color:#e8eaf0;}
    .btn-ico.danger:hover{background:rgba(231,76,60,.15);color:#e74c3c;}
    .btn-ico mat-icon{font-size:17px;width:17px;height:17px;}
    .btn-danger{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;background:rgba(231,76,60,.12);color:#e74c3c;border:1px solid rgba(231,76,60,.3);border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;}

    /* Messages */
    .err-msg{display:flex;align-items:center;gap:6px;background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.2);border-radius:8px;padding:8px 12px;color:#e74c3c;font-size:13px;margin:8px 0;}
    .ok-msg{display:flex;align-items:flex-start;gap:8px;background:rgba(0,184,148,.1);border:1px solid rgba(0,184,148,.2);border-radius:8px;padding:10px 12px;color:#00b894;font-size:13px;margin:8px 0;}
    .ok-msg mat-icon,.err-msg mat-icon{flex-shrink:0;font-size:18px;}
    .ok-msg em{font-style:normal;font-size:11px;color:#8892a4;}

    /* Cards/sections */
    h3{font-size:16px;font-weight:700;color:#e8eaf0;margin-bottom:16px;}
    h4{font-size:14px;font-weight:700;color:#e8eaf0;display:flex;align-items:center;gap:6px;margin-bottom:6px;}
    h4 mat-icon{font-size:17px;}
    .form-card{background:#0f1b2d;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:20px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px;}
    .tool-card{background:#0f1b2d;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px;}
    .tool-card p{font-size:13px;color:#8892a4;}
    .tool-card.danger-zone{border-color:rgba(231,76,60,.25);}
    .f-row{display:flex;gap:10px;flex-wrap:wrap;}
    .f-grp{display:flex;flex-direction:column;gap:5px;flex:1;min-width:180px;}
    .f-grp label{font-size:11px;font-weight:700;color:#8892a4;text-transform:uppercase;letter-spacing:.4px;}

    /* Pill statut */
    .pill{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:rgba(231,76,60,.15);color:#e74c3c;white-space:nowrap;}
    .pill.on{background:rgba(0,184,148,.15);color:#00b894;}

    /* Loader / Empty */
    .adm-loading{display:flex;align-items:center;justify-content:center;gap:8px;color:#8892a4;padding:32px;font-size:13px;}
    .empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px;color:#4a5568;}
    .empty mat-icon{font-size:36px;width:36px;height:36px;opacity:.4;}

    /* Modal */
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;}
    .modal{background:#0f1b2d;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:24px;width:100%;max-width:420px;display:flex;flex-direction:column;gap:12px;}
    .modal-head{display:flex;align-items:center;justify-content:space-between;}
    .modal-head h3{margin:0;font-size:16px;}
    .modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:4px;}

    /* Animation */
    .spin{animation:spin 1s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg);}}

    /* Scrollbar */
    .adm-body::-webkit-scrollbar{width:5px;}
    .adm-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px;}

    /* Mobile */
    @media(max-width:500px){
      .patron-row{grid-template-columns:auto 1fr;}
      .p-actions{grid-column:1/-1;justify-content:flex-start;}
      .f-row{flex-direction:column;}
    }
  `]
})
export class AdminComponent implements OnInit {
  private readonly SK = 'ss_admin_key';
  readonly base = environment.apiUrl.replace(/\/+$/, '').replace(/\/api$/, '') + '/api/admin';
  readonly isProd = this.base.includes('nhmt') || this.base.includes('render');

  // Auth
  keyInput = '';
  private _ok = signal(false);
  readonly ok = this._ok.asReadonly();
  authBusy = false;
  authErr = '';

  // Stats & patrons
  private _stats = signal<any>(null);
  readonly stats = this._stats.asReadonly();
  private _patrons = signal<Patron[]>([]);
  readonly patrons = this._patrons.asReadonly();
  private _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  q = '';
  readonly patronsFiltres = computed(() => {
    const ql = this.q.toLowerCase().trim();
    if (!ql) return this._patrons();
    return this._patrons().filter(p =>
      p.nom?.toLowerCase().includes(ql) ||
      p.email?.toLowerCase().includes(ql) ||
      p.boutique?.toLowerCase().includes(ql) ||
      p.tenantId?.toLowerCase().includes(ql)
    );
  });
  toggling: Record<string, boolean> = {};

  // Équipe
  equipeOuvert: string | null = null;
  equipe: Agent[] = [];
  equipeLoading = false;

  // Onglet
  tab: 'patrons' | 'creer' | 'outils' = 'patrons';

  // Créer
  nv = { nom: '', boutique: '', email: '', telephone: '', password: '' };
  nvBusy = false;
  nvOk: { nom: string; mdp?: string } | null = null;
  nvErr = '';

  // Édition
  editP: Patron | null = null;
  editF = { nom: '', email: '', boutique: '' };
  editBusy = false;
  editErr = '';

  // Outils
  resetMail = ''; resetPass = ''; resetBusy = false; resetOk = ''; resetErr = '';
  purgeBusy = false; purgeOk = ''; purgeErr = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const stored = sessionStorage.getItem(this.SK);
    if (stored) { this.keyInput = stored; this._ok.set(true); this.loadAll(); }
  }

  private h(): HttpHeaders {
    return new HttpHeaders({ 'x-admin-key': this.keyInput });
  }

  connect(): void {
    if (!this.keyInput.trim() || this.authBusy) return;
    this.authBusy = true; this.authErr = '';
    this.http.get(`${this.base}/stats`, { headers: this.h() }).subscribe({
      next: () => {
        sessionStorage.setItem(this.SK, this.keyInput);
        this._ok.set(true); this.authBusy = false;
        this.loadAll(); this.cdr.detectChanges();
      },
      error: (e) => {
        this.authBusy = false;
        this.authErr = (e.status === 401 || e.status === 403) ? 'Clé incorrecte' : 'Erreur réseau';
        this.cdr.detectChanges();
      },
    });
  }

  logout(): void {
    sessionStorage.removeItem(this.SK);
    this._ok.set(false); this.keyInput = '';
    this._stats.set(null); this._patrons.set([]);
  }

  loadAll(): void { this.loadStats(); this.loadPatrons(); }

  loadStats(): void {
    this.http.get<any>(`${this.base}/stats`, { headers: this.h() }).subscribe({
      next: (r) => { this._stats.set(r.data || r); this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadPatrons(): void {
    this._loading.set(true);
    this.http.get<any>(`${this.base}/users`, { headers: this.h() }).subscribe({
      next: (r) => { this._patrons.set(r.data || []); this._loading.set(false); this.cdr.detectChanges(); },
      error: () => { this._loading.set(false); this.cdr.detectChanges(); },
    });
  }

  togglePatron(p: Patron): void {
    if (this.toggling[p._id]) return;
    // Optimiste : changer l'UI immédiatement
    this.toggling[p._id] = true;
    const ancienEtat = p.actif;
    p.actif = !p.actif;
    this.cdr.detectChanges();

    this.http.patch<any>(`${this.base}/users/${p._id}/toggle`, {}, { headers: this.h() }).subscribe({
      next: (r) => {
        // Confirmer avec la valeur du serveur
        p.actif = r.data?.actif ?? p.actif;
        delete this.toggling[p._id];
        this.loadStats(); this.cdr.detectChanges();
      },
      error: () => {
        // Rollback si erreur
        p.actif = ancienEtat;
        delete this.toggling[p._id];
        this.cdr.detectChanges();
      },
    });
  }

  deletePatron(p: Patron): void {
    if (!confirm(`Supprimer "${p.nom}" et toutes ses données ? Irréversible.`)) return;
    this.http.delete(`${this.base}/users/${p._id}`, { headers: this.h() }).subscribe({
      next: () => {
        this._patrons.update(arr => arr.filter(x => x._id !== p._id));
        this.loadStats(); this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  openEdit(p: Patron): void {
    this.editP = p;
    this.editF = { nom: p.nom, email: p.email, boutique: p.boutique || '' };
    this.editErr = '';
  }
  closeEdit(): void { this.editP = null; }

  saveEdit(): void {
    if (!this.editP || this.editBusy) return;
    this.editBusy = true; this.editErr = '';
    this.http.patch<any>(`${this.base}/users/${this.editP._id}`, this.editF, { headers: this.h() }).subscribe({
      next: (r) => {
        this._patrons.update(arr => arr.map(p =>
          p._id === this.editP!._id ? { ...p, ...(r.data || this.editF) } : p
        ));
        this.editBusy = false; this.editP = null; this.cdr.detectChanges();
      },
      error: (e) => {
        this.editErr = e.error?.message || 'Erreur';
        this.editBusy = false; this.cdr.detectChanges();
      },
    });
  }

  toggleEquipe(p: Patron): void {
    if (this.equipeOuvert === p._id) { this.equipeOuvert = null; this.equipe = []; return; }
    this.equipeOuvert = p._id; this.equipe = []; this.equipeLoading = true;
    this.http.get<any>(`${this.base}/team/${p.tenantId}`, { headers: this.h() }).subscribe({
      next: (r) => { this.equipe = r.data || []; this.equipeLoading = false; this.cdr.detectChanges(); },
      error: () => { this.equipeLoading = false; this.cdr.detectChanges(); },
    });
  }

  creerPatron(): void {
    if (this.nvBusy) return;
    this.nvBusy = true; this.nvOk = null; this.nvErr = '';
    this.http.post<any>(`${this.base}/users`, this.nv, { headers: this.h() }).subscribe({
      next: (r) => {
        const d = r.data || {};
        this.nvOk = { nom: d.nom || this.nv.nom, mdp: d.motDePasse || r.motDePasse };
        this.nv = { nom: '', boutique: '', email: '', telephone: '', password: '' };
        this.nvBusy = false; this.loadPatrons(); this.cdr.detectChanges();
      },
      error: (e) => { this.nvErr = e.error?.message || 'Erreur'; this.nvBusy = false; this.cdr.detectChanges(); },
    });
  }

  resetByEmail(): void {
    if (!this.resetMail.trim() || this.resetBusy) return;
    this.resetBusy = true; this.resetOk = ''; this.resetErr = '';
    this.http.post<any>(`${this.base}/reset-password`, {
      email: this.resetMail, newPassword: this.resetPass || undefined
    }, { headers: this.h() }).subscribe({
      next: (r) => {
        const mdp = r.nouveauMotDePasse || r.data?.nouveauMotDePasse;
        this.resetOk = mdp ? `Mot de passe : ${mdp}` : 'Réinitialisation réussie';
        this.resetMail = ''; this.resetPass = '';
        this.resetBusy = false; this.cdr.detectChanges();
      },
      error: (e) => { this.resetErr = e.error?.message || 'Erreur'; this.resetBusy = false; this.cdr.detectChanges(); },
    });
  }

  purgerVentes(): void {
    if (!confirm('Supprimer TOUTES les ventes ?')) return;
    this.purgeBusy = true; this.purgeOk = ''; this.purgeErr = '';
    this.http.delete<any>(`${this.base}/ventes`, { headers: this.h() }).subscribe({
      next: (r) => { this.purgeOk = r.message || 'Ventes supprimées'; this.purgeBusy = false; this.loadStats(); this.cdr.detectChanges(); },
      error: (e) => { this.purgeErr = e.error?.message || 'Erreur'; this.purgeBusy = false; this.cdr.detectChanges(); },
    });
  }
}
