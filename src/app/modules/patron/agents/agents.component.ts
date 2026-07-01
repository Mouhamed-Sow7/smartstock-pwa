import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

// ─── Dialog Nouvelle Boutique ─────────────────────────────────────────────
@Component({
  selector: 'app-boutique-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dlg">
      <div class="dlg-head">
        <div class="dlg-ico"><mat-icon>store</mat-icon></div>
        <div>
          <div class="dlg-title">{{ data ? 'Modifier la boutique' : 'Nouvelle boutique' }}</div>
          <div class="dlg-sub">Les agents seront associés à cette boutique</div>
        </div>
        <button class="dlg-close" (click)="ref.close()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="dlg-body">
        <form [formGroup]="form">
          <div class="f-group">
            <label>Nom de la boutique <span class="req">*</span></label>
            <input formControlName="nom" placeholder="Ex: Supermarché Dakar Nord" />
          </div>
          <div class="f-row">
            <div class="f-group">
              <label>Téléphone</label>
              <input formControlName="telephone" placeholder="+221 77..." />
            </div>
            <div class="f-group">
              <label>Adresse</label>
              <input formControlName="adresse" placeholder="Quartier, ville" />
            </div>
          </div>
          <div class="f-group">
            <label>Description</label>
            <input formControlName="description" placeholder="Optionnel" />
          </div>
        </form>
      </div>
      <div class="dlg-foot">
        <button class="btn-cancel" (click)="ref.close()">Annuler</button>
        <button class="btn-save" [disabled]="form.invalid || loading" (click)="save()">
          <mat-spinner *ngIf="loading" diameter="14"></mat-spinner>
          <mat-icon *ngIf="!loading">{{ data ? 'check' : 'add' }}</mat-icon>
          {{ data ? 'Mettre à jour' : 'Créer la boutique' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dlg { background:#0f1b2d; border-radius:16px; width:min(480px,95vw); display:flex; flex-direction:column; }
    .dlg-head { display:flex; align-items:center; gap:12px; padding:18px 18px 14px; border-bottom:1px solid rgba(255,255,255,.07); }
    .dlg-ico { width:38px; height:38px; border-radius:10px; background:rgba(0,184,148,.15); border:1px solid rgba(0,184,148,.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .dlg-ico mat-icon { color:#00b894; font-size:20px; }
    .dlg-title { font-size:15px; font-weight:700; color:#e8eaf0; }
    .dlg-sub { font-size:11px; color:#4a5568; }
    .dlg-close { margin-left:auto; width:30px; height:30px; border-radius:8px; border:none; background:rgba(255,255,255,.05); color:#4a5568; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .dlg-close mat-icon { font-size:17px; }
    .dlg-body { padding:14px 18px; display:flex; flex-direction:column; gap:12px; }
    .f-group { display:flex; flex-direction:column; gap:5px; }
    .f-group label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#4a5568; }
    .f-group input { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:9px 11px; color:#e8eaf0; font-size:16px; outline:none; }
    .f-group input:focus { border-color:#00b894; }
    .req { color:#e74c3c; }
    .f-row { display:flex; gap:10px; }
    .f-row .f-group { flex:1; }
    .dlg-foot { display:flex; gap:10px; padding:12px 18px; border-top:1px solid rgba(255,255,255,.07); }
    .btn-cancel { padding:9px 16px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#8892a4; font-size:13px; cursor:pointer; }
    .btn-save { flex:1; padding:9px; border-radius:8px; border:none; background:#00b894; color:#04241c; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; }
    .btn-save:disabled { opacity:.45; cursor:not-allowed; }
    .btn-save mat-icon { font-size:16px; width:16px; height:16px; }
  `]
})
export class BoutiqueDialogComponent {
  ref = inject(MatDialogRef<BoutiqueDialogComponent>);
  data: any = inject(MAT_DIALOG_DATA);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  loading = false;
  form = this.fb.group({
    nom: [this.data?.nom || '', Validators.required],
    telephone: [this.data?.telephone || ''],
    adresse: [this.data?.adresse || ''],
    description: [this.data?.description || ''],
  });
  save() {
    if (this.form.invalid) return;
    this.loading = true;
    const obs = this.data?._id
      ? this.api.patch(`boutiques/${this.data._id}`, this.form.value)
      : this.api.post('boutiques', this.form.value);
    obs.subscribe({ next: (r: any) => { this.loading = false; this.ref.close(r.data); }, error: () => { this.loading = false; } });
  }
}

// ─── Dialog Nouvel Agent ───────────────────────────────────────────────────
@Component({
  selector: 'app-agent-create-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dlg">
      <div class="dlg-head">
        <div class="dlg-ico blue"><mat-icon>{{ resultat ? 'check_circle' : 'person_add' }}</mat-icon></div>
        <div>
          <div class="dlg-title">{{ resultat ? 'Agent créé' : 'Nouvel agent' }}</div>
          <div class="dlg-sub">Boutique : <strong>{{ data.boutique.nom }}</strong></div>
        </div>
        <button class="dlg-close" (click)="fermer()"><mat-icon>close</mat-icon></button>
      </div>

      <!-- Étape 1 : formulaire -->
      <div class="dlg-body" *ngIf="!resultat">
        <form [formGroup]="form">
          <div class="f-row">
            <div class="f-group">
              <label>Prénom <span class="req">*</span></label>
              <input formControlName="prenom" placeholder="Mamadou" />
            </div>
            <div class="f-group">
              <label>Nom <span class="req">*</span></label>
              <input formControlName="nom" placeholder="Diallo" />
            </div>
          </div>
          <div class="f-group">
            <label>Téléphone <span class="opt">optionnel — identifiant de connexion alternatif</span></label>
            <input formControlName="telephone" placeholder="77 123 45 67" type="tel" />
            <span class="f-hint">Avec ou sans indicatif 221, peu importe le format.</span>
          </div>
        </form>
        <div class="login-preview" *ngIf="form.get('prenom')?.value && form.get('nom')?.value">
          <mat-icon>info</mat-icon>
          <div>
            <div class="lp-title">Identifiant de connexion</div>
            <div class="lp-email">{{ getEmailPreview() }}</div>
            <div class="lp-mdp">Un mot de passe sera généré automatiquement — il ne sera affiché qu'une seule fois.</div>
          </div>
        </div>
      </div>

      <!-- Étape 2 : résultat (mot de passe généré, copiable) -->
      <div class="dlg-body" *ngIf="resultat">
        <div class="result-banner">
          <mat-icon>check_circle</mat-icon>
          <span>{{ resultat.prenom }} {{ resultat.nom }} peut maintenant se connecter</span>
        </div>
        <div class="cred-card">
          <div class="cred-row">
            <span class="cred-label">Email</span>
            <span class="cred-value">{{ resultat.email }}</span>
          </div>
          <div class="cred-row" *ngIf="resultat.telephone">
            <span class="cred-label">Téléphone</span>
            <span class="cred-value">{{ resultat.telephone }}</span>
          </div>
          <div class="cred-row highlight">
            <span class="cred-label">Mot de passe</span>
            <span class="cred-value mono">{{ resultat.motDePasseGenere }}</span>
          </div>
        </div>
        <div class="cred-warning">
          <mat-icon>warning</mat-icon>
          <span>Ce mot de passe ne sera plus jamais affiché. Transmets-le à l'agent maintenant.</span>
        </div>
      </div>

      <div class="dlg-foot" *ngIf="!resultat">
        <button class="btn-cancel" (click)="ref.close()">Annuler</button>
        <button class="btn-save" [disabled]="form.invalid || loading" (click)="save()">
          <mat-spinner *ngIf="loading" diameter="14"></mat-spinner>
          <mat-icon *ngIf="!loading">person_add</mat-icon>
          Créer l'agent
        </button>
      </div>
      <div class="dlg-foot" *ngIf="resultat">
        <button class="btn-cancel" (click)="copier()">
          <mat-icon>content_copy</mat-icon> Copier
        </button>
        <button class="btn-save" (click)="ref.close(resultat)">
          <mat-icon>check</mat-icon> J'ai noté, fermer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dlg { background:#0f1b2d; border-radius:16px; width:min(440px,95vw); display:flex; flex-direction:column; max-height:90vh; max-height:90dvh; }
    .dlg-head { display:flex; align-items:center; gap:12px; padding:18px 18px 14px; border-bottom:1px solid rgba(255,255,255,.07); }
    .dlg-ico { width:38px; height:38px; border-radius:10px; background:rgba(0,184,148,.15); border:1px solid rgba(0,184,148,.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .dlg-ico.blue { background:rgba(9,132,227,.15); border-color:rgba(9,132,227,.25); }
    .dlg-ico mat-icon { color:#0984e3; font-size:20px; }
    .dlg-title { font-size:15px; font-weight:700; color:#e8eaf0; }
    .dlg-sub { font-size:11px; color:#4a5568; }
    .dlg-sub strong { color:#8892a4; }
    .dlg-close { margin-left:auto; width:30px; height:30px; border-radius:8px; border:none; background:rgba(255,255,255,.05); color:#4a5568; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .dlg-close mat-icon { font-size:17px; }
    .dlg-body { padding:14px 18px; display:flex; flex-direction:column; gap:12px; overflow-y:auto; }
    .f-group { display:flex; flex-direction:column; gap:5px; }
    .f-group label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#4a5568; }
    .f-group input { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:9px 11px; color:#e8eaf0; font-size:16px; outline:none; }
    .f-group input:focus { border-color:#0984e3; }
    .f-hint { font-size:10px; color:#4a5568; }
    .req { color:#e74c3c; }
    .opt { color:#636e72; font-size:9px; text-transform:none; letter-spacing:0; font-weight:400; }
    .f-row { display:flex; gap:10px; }
    .f-row .f-group { flex:1; }
    .login-preview { background:rgba(9,132,227,.08); border:1px solid rgba(9,132,227,.2); border-radius:10px; padding:10px 12px; display:flex; gap:8px; align-items:flex-start; }
    .login-preview mat-icon { color:#0984e3; font-size:16px; width:16px; height:16px; flex-shrink:0; margin-top:2px; }
    .lp-title { font-size:11px; color:#8892a4; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-bottom:3px; }
    .lp-email { font-size:12px; font-family:monospace; color:#74b9ff; font-weight:600; }
    .lp-mdp { font-size:11px; color:#636e72; margin-top:4px; line-height:1.4; }
    .result-banner { display:flex; align-items:center; gap:8px; background:rgba(0,184,148,.1); border:1px solid rgba(0,184,148,.25); border-radius:10px; padding:10px 12px; font-size:13px; color:#00b894; font-weight:600; }
    .result-banner mat-icon { font-size:18px; width:18px; height:18px; }
    .cred-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:10px; overflow:hidden; }
    .cred-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,.05); gap:10px; }
    .cred-row:last-child { border-bottom:none; }
    .cred-row.highlight { background:rgba(0,184,148,.07); }
    .cred-label { font-size:11px; color:#636e72; font-weight:600; text-transform:uppercase; letter-spacing:.4px; flex-shrink:0; }
    .cred-value { font-size:13px; color:#e8eaf0; font-weight:600; text-align:right; word-break:break-all; }
    .cred-value.mono { font-family:monospace; font-size:15px; color:#00b894; letter-spacing:.5px; }
    .cred-warning { display:flex; gap:8px; align-items:flex-start; font-size:11px; color:#fdcb6e; background:rgba(253,203,110,.08); border:1px solid rgba(253,203,110,.2); border-radius:8px; padding:9px 11px; line-height:1.4; }
    .cred-warning mat-icon { font-size:15px; width:15px; height:15px; flex-shrink:0; margin-top:1px; }
    .dlg-foot { display:flex; gap:10px; padding:12px 18px; border-top:1px solid rgba(255,255,255,.07); }
    .btn-cancel { padding:9px 16px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#8892a4; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:5px; }
    .btn-cancel mat-icon { font-size:15px; width:15px; height:15px; }
    .btn-save { flex:1; padding:9px; border-radius:8px; border:none; background:#0984e3; color:#fff; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; }
    .btn-save:disabled { opacity:.45; cursor:not-allowed; }
    .btn-save mat-icon { font-size:16px; width:16px; height:16px; }
  `]
})
export class AgentCreateDialogComponent {
  ref = inject(MatDialogRef<AgentCreateDialogComponent>);
  data: any = inject(MAT_DIALOG_DATA);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  loading = false;
  resultat: any = null;
  form = this.fb.group({
    prenom: ['', Validators.required],
    nom: ['', Validators.required],
    telephone: [''],
  });
  getEmailPreview(): string {
    const p = (this.form.get('prenom')?.value || '').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    const n = (this.form.get('nom')?.value || '').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    return `${p}.${n}@${this.data.boutique.slug}.sm`;
  }
  save() {
    if (this.form.invalid) return;
    this.loading = true;
    this.api.post(`boutiques/${this.data.boutique._id}/agents`, this.form.value).subscribe({
      next: (r: any) => { this.loading = false; this.resultat = r.data; },
      error: () => { this.loading = false; }
    });
  }
  copier() {
    if (!this.resultat) return;
    const lines = [`Email: ${this.resultat.email}`, `Mot de passe: ${this.resultat.motDePasseGenere}`];
    if (this.resultat.telephone) lines.splice(1, 0, `Téléphone: ${this.resultat.telephone}`);
    navigator.clipboard?.writeText(lines.join('\n'));
  }
  fermer() { this.ref.close(this.resultat || null); }
}

// ─── Dialog résultat reset mot de passe ───────────────────────────────────
@Component({
  selector: 'app-password-result-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="dlg">
      <div class="dlg-head">
        <div class="dlg-ico"><mat-icon>vpn_key</mat-icon></div>
        <div>
          <div class="dlg-title">Mot de passe réinitialisé</div>
          <div class="dlg-sub">{{ data.nom }}</div>
        </div>
        <button class="dlg-close" (click)="ref.close()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="dlg-body">
        <div class="cred-card">
          <div class="cred-row" *ngIf="data.email">
            <span class="cred-label">Email</span>
            <span class="cred-value">{{ data.email }}</span>
          </div>
          <div class="cred-row highlight">
            <span class="cred-label">Nouveau mot de passe</span>
            <span class="cred-value mono">{{ data.motDePasseGenere }}</span>
          </div>
        </div>
        <div class="cred-warning">
          <mat-icon>warning</mat-icon>
          <span>Ce mot de passe ne sera plus jamais affiché. Transmets-le à l'agent maintenant.</span>
        </div>
      </div>
      <div class="dlg-foot">
        <button class="btn-cancel" (click)="copier()">
          <mat-icon>content_copy</mat-icon> Copier
        </button>
        <button class="btn-save" (click)="ref.close()">
          <mat-icon>check</mat-icon> J'ai noté, fermer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dlg { background:#0f1b2d; border-radius:16px; width:min(400px,95vw); display:flex; flex-direction:column; max-height:90vh; max-height:90dvh; }
    .dlg-head { display:flex; align-items:center; gap:12px; padding:18px 18px 14px; border-bottom:1px solid rgba(255,255,255,.07); }
    .dlg-ico { width:38px; height:38px; border-radius:10px; background:rgba(0,184,148,.15); border:1px solid rgba(0,184,148,.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .dlg-ico mat-icon { color:#00b894; font-size:20px; }
    .dlg-title { font-size:15px; font-weight:700; color:#e8eaf0; }
    .dlg-sub { font-size:11px; color:#8892a4; }
    .dlg-close { margin-left:auto; width:30px; height:30px; border-radius:8px; border:none; background:rgba(255,255,255,.05); color:#4a5568; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .dlg-close mat-icon { font-size:17px; }
    .dlg-body { padding:14px 18px; display:flex; flex-direction:column; gap:12px; overflow-y:auto; }
    .cred-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:10px; overflow:hidden; }
    .cred-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,.05); gap:10px; }
    .cred-row:last-child { border-bottom:none; }
    .cred-row.highlight { background:rgba(0,184,148,.07); }
    .cred-label { font-size:11px; color:#636e72; font-weight:600; text-transform:uppercase; letter-spacing:.4px; flex-shrink:0; }
    .cred-value { font-size:13px; color:#e8eaf0; font-weight:600; text-align:right; word-break:break-all; }
    .cred-value.mono { font-family:monospace; font-size:15px; color:#00b894; letter-spacing:.5px; }
    .cred-warning { display:flex; gap:8px; align-items:flex-start; font-size:11px; color:#fdcb6e; background:rgba(253,203,110,.08); border:1px solid rgba(253,203,110,.2); border-radius:8px; padding:9px 11px; line-height:1.4; }
    .cred-warning mat-icon { font-size:15px; width:15px; height:15px; flex-shrink:0; margin-top:1px; }
    .dlg-foot { display:flex; gap:10px; padding:12px 18px; border-top:1px solid rgba(255,255,255,.07); }
    .btn-cancel { padding:9px 16px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#8892a4; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:5px; }
    .btn-cancel mat-icon { font-size:15px; width:15px; height:15px; }
    .btn-save { flex:1; padding:9px; border-radius:8px; border:none; background:#00b894; color:#04241c; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; }
    .btn-save mat-icon { font-size:16px; width:16px; height:16px; }
  `]
})
export class PasswordResultDialogComponent {
  ref = inject(MatDialogRef<PasswordResultDialogComponent>);
  data: any = inject(MAT_DIALOG_DATA);
  copier() {
    const text = this.data.email
      ? `Email: ${this.data.email}\nMot de passe: ${this.data.motDePasseGenere}`
      : `Mot de passe: ${this.data.motDePasseGenere}`;
    navigator.clipboard?.writeText(text);
  }
}

// ─── Page principale Agents ────────────────────────────────────────────────
@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule, MatTooltipModule,
  ],
  template: `
    <div class="agents-page">
      <div class="page-header">
        <h1>Boutiques & Agents</h1>
        <button class="btn-primary" (click)="ouvrirCreerBoutique()">
          <mat-icon>add</mat-icon> Boutique
        </button>
      </div>

      <div class="loading-center" *ngIf="isLoading()">
        <mat-spinner diameter="36"></mat-spinner>
      </div>

      <div class="empty-state" *ngIf="!isLoading() && boutiques().length === 0">
        <mat-icon>store_mall_directory</mat-icon>
        <p>Aucune boutique. Créez votre première boutique.</p>
      </div>

      <div class="boutiques-list" *ngIf="!isLoading()">
        <div class="boutique-block" *ngFor="let b of boutiques()">

          <div class="boutique-header" (click)="toggleExpand(b._id)">
            <div class="boutique-avatar"><mat-icon>store</mat-icon></div>
            <div class="boutique-info">
              <div class="boutique-nom">{{ b.nom }}</div>
              <div class="boutique-meta">
                <span class="slug-badge">@{{ b.slug }}</span>
                <span *ngIf="b.telephone">· {{ b.telephone }}</span>
                <span class="agents-count">{{ b.agentsCount || 0 }} agent(s)</span>
              </div>
            </div>
            <div class="boutique-actions">
              <button class="ico-btn" (click)="ouvrirModifierBoutique(b, $event)" matTooltip="Modifier">
                <mat-icon>edit</mat-icon>
              </button>
              <button class="ico-btn danger" (click)="supprimerBoutique(b, $event)" matTooltip="Supprimer">
                <mat-icon>delete</mat-icon>
              </button>
              <mat-icon class="expand-icon" [class.expanded]="expandedId === b._id">expand_more</mat-icon>
            </div>
          </div>

          <div class="agents-list" *ngIf="expandedId === b._id">
            <div class="agents-loading" *ngIf="loadingAgents() === b._id">
              <mat-spinner diameter="20"></mat-spinner>
            </div>

            <div class="agent-row" *ngFor="let a of agentsMap()[b._id] || []">
              <div class="agent-avatar">{{ (a.prenom || a.nom || 'A').charAt(0).toUpperCase() }}</div>
              <div class="agent-info">
                <div class="agent-nom">{{ a.prenom }} {{ a.nom }}</div>
                <div class="agent-email">{{ a.email }}</div>
              </div>
              <div class="agent-actions">
                <span class="status-dot" [class.actif]="a.actif" [matTooltip]="a.actif ? 'Actif' : 'Inactif'"></span>
                <button class="ico-btn-sm" (click)="toggleAgent(b._id, a)" [matTooltip]="a.actif ? 'Désactiver' : 'Activer'">
                  <mat-icon>{{ a.actif ? 'toggle_on' : 'toggle_off' }}</mat-icon>
                </button>
                <button class="ico-btn-sm" (click)="reinitialiserMotDePasse(a)" matTooltip="Réinitialiser mot de passe">
                  <mat-icon>key</mat-icon>
                </button>
                <button class="ico-btn-sm danger" (click)="supprimerAgent(b._id, a)" matTooltip="Supprimer">
                  <mat-icon>person_remove</mat-icon>
                </button>
              </div>
            </div>

            <div class="no-agents" *ngIf="(agentsMap()[b._id] || []).length === 0 && loadingAgents() !== b._id">
              Aucun agent dans cette boutique
            </div>

            <button class="btn-add-agent" (click)="ouvrirCreerAgent(b)">
              <mat-icon>person_add</mat-icon> Ajouter un agent
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .agents-page { max-width:800px; margin:0 auto; padding-bottom:32px; }
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
    h1 { font-size:22px; font-weight:800; color:var(--text-1); margin:0; }
    .btn-primary { padding:10px 16px; border-radius:12px; border:none; background:var(--accent); color:#04241c; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; }
    .btn-primary mat-icon { font-size:18px; width:18px; height:18px; }
    .loading-center { display:flex; justify-content:center; padding:60px; }
    .empty-state { text-align:center; padding:60px 20px; color:var(--text-3); }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; margin-bottom:12px; }
    .boutiques-list { display:flex; flex-direction:column; gap:12px; }
    .boutique-block { background:var(--navy-card); border:1px solid rgba(255,255,255,.07); border-radius:14px; overflow:hidden; }
    .boutique-header { display:flex; align-items:center; gap:12px; padding:14px; cursor:pointer; transition:background .12s; }
    .boutique-header:hover { background:rgba(255,255,255,.03); }
    .boutique-avatar { width:40px; height:40px; border-radius:10px; background:rgba(0,184,148,.15); border:1px solid rgba(0,184,148,.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .boutique-avatar mat-icon { color:var(--accent); font-size:20px; }
    .boutique-info { flex:1; min-width:0; }
    .boutique-nom { font-size:15px; font-weight:700; color:var(--text-1); }
    .boutique-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px; font-size:12px; color:var(--text-3); }
    .slug-badge { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); border-radius:4px; padding:1px 6px; font-family:monospace; font-size:11px; color:var(--text-2); }
    .agents-count { margin-left:auto; background:rgba(0,184,148,.1); color:var(--accent); border-radius:20px; padding:1px 8px; font-size:11px; font-weight:700; }
    .boutique-actions { display:flex; align-items:center; gap:4px; }
    .ico-btn { width:30px; height:30px; border-radius:7px; border:none; background:transparent; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .ico-btn:hover { background:rgba(255,255,255,.07); color:var(--text-1); }
    .ico-btn.danger:hover { background:rgba(231,76,60,.1); color:#e74c3c; }
    .ico-btn mat-icon { font-size:17px; }
    .expand-icon { font-size:20px; color:var(--text-3); transition:transform .2s; }
    .expand-icon.expanded { transform:rotate(180deg); }
    .agents-list { border-top:1px solid rgba(255,255,255,.05); padding:8px 14px 12px; display:flex; flex-direction:column; gap:4px; }
    .agents-loading { display:flex; justify-content:center; padding:12px; }
    .agent-row { display:flex; align-items:center; gap:10px; padding:8px 6px; border-radius:8px; }
    .agent-row:hover { background:rgba(255,255,255,.03); }
    .agent-avatar { width:32px; height:32px; border-radius:50%; background:rgba(9,132,227,.15); border:1px solid rgba(9,132,227,.25); display:flex; align-items:center; justify-content:center; color:#0984e3; font-size:13px; font-weight:700; flex-shrink:0; }
    .agent-info { flex:1; min-width:0; }
    .agent-nom { font-size:13px; font-weight:600; color:var(--text-1); }
    .agent-email { font-size:11px; color:var(--text-3); font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .agent-actions { display:flex; align-items:center; gap:4px; }
    .status-dot { width:8px; height:8px; border-radius:50%; background:#e74c3c; }
    .status-dot.actif { background:#00b894; }
    .ico-btn-sm { width:28px; height:28px; border-radius:6px; border:none; background:transparent; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .ico-btn-sm:hover { background:rgba(255,255,255,.07); color:var(--text-1); }
    .ico-btn-sm.danger:hover { background:rgba(231,76,60,.1); color:#e74c3c; }
    .ico-btn-sm mat-icon { font-size:16px; }
    .no-agents { font-size:12px; color:var(--text-3); text-align:center; padding:12px 0 6px; }
    .btn-add-agent { margin-top:6px; padding:8px; border-radius:8px; border:1px dashed rgba(9,132,227,.3); background:rgba(9,132,227,.06); color:#0984e3; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; width:100%; }
    .btn-add-agent:hover { background:rgba(9,132,227,.12); }
    .btn-add-agent mat-icon { font-size:16px; width:16px; height:16px; }
  `]
})
export class AgentsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  boutiques = signal<any[]>([]);
  isLoading = signal(true);
  expandedId: string | null = null;
  // Convertis en signals : Angular trackera automatiquement les mutations
  // et re-rendra le template sans nécessiter d'appel explicite à markForCheck.
  loadingAgents = signal<string | null>(null);
  agentsMap = signal<Record<string, any[]>>({});

  ngOnInit() { this.charger(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  charger() {
    this.isLoading.set(true);
    this.api.get('boutiques').pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => { this.boutiques.set(r.data || []); this.isLoading.set(false); },
      error: () => { this.isLoading.set(false); this.snack.open('Erreur chargement', 'OK', { duration: 3000 }); }
    });
  }

  toggleExpand(id: string) {
    if (this.expandedId === id) { this.expandedId = null; return; }
    this.expandedId = id;
    if (!this.agentsMap[id]) this.chargerAgents(id);
  }

  chargerAgents(boutiqueId: string) {
    this.loadingAgents.set(boutiqueId);
    this.api.get(`boutiques/${boutiqueId}/agents`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.agentsMap.update(m => ({ ...m, [boutiqueId]: r.data || [] }));
        this.loadingAgents.set(null);
      },
      error: () => { this.loadingAgents.set(null); }
    });
  }

  ouvrirCreerBoutique() {
    this.dialog.open(BoutiqueDialogComponent, { data: null, maxWidth: '100vw', panelClass: 'produit-dialog-panel' })
      .afterClosed().subscribe(b => { if (b) { this.boutiques.update(l => [b, ...l]); this.snack.open('Boutique créée', 'OK', { duration: 2000 }); } });
  }

  ouvrirModifierBoutique(b: any, e: Event) {
    e.stopPropagation();
    this.dialog.open(BoutiqueDialogComponent, { data: b, maxWidth: '100vw', panelClass: 'produit-dialog-panel' })
      .afterClosed().subscribe(updated => {
        if (updated) {
          this.boutiques.update(l => l.map(x => x._id === updated._id ? { ...x, ...updated } : x));
          this.snack.open('Boutique mise à jour', 'OK', { duration: 2000 });
        }
      });
  }

  supprimerBoutique(b: any, e: Event) {
    e.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, { data: { title: 'Supprimer', message: `Supprimer "${b.nom}" ?` } })
      .afterClosed().subscribe(ok => {
        if (!ok) return;
        this.api.delete(`boutiques/${b._id}`).subscribe({
          next: () => { this.boutiques.update(l => l.filter(x => x._id !== b._id)); this.snack.open('Boutique supprimée', 'OK', { duration: 2000 }); },
          error: (err: any) => this.snack.open(err?.error?.message || 'Erreur', 'OK', { duration: 4000 })
        });
      });
  }

  ouvrirCreerAgent(boutique: any) {
    this.dialog.open(AgentCreateDialogComponent, { data: { boutique }, maxWidth: '100vw', panelClass: 'produit-dialog-panel' })
      .afterClosed().subscribe(agent => {
        if (!agent) return;
        this.agentsMap.update(m => ({ ...m, [boutique._id]: [agent, ...(m[boutique._id] || [])] }));
        this.boutiques.update(l => l.map(b => b._id === boutique._id ? { ...b, agentsCount: (b.agentsCount || 0) + 1 } : b));
        this.snack.open(`${agent.prenom} ${agent.nom} ajouté`, 'OK', { duration: 2000 });
      });
  }

  toggleAgent(boutiqueId: string, agent: any) {
    this.api.patch(`boutiques/agents/${agent._id}/toggle`, {}).subscribe({
      next: (r: any) => {
        this.agentsMap.update(m => ({
          ...m,
          [boutiqueId]: (m[boutiqueId] || []).map(a => a._id === agent._id ? { ...a, actif: r.data.actif } : a)
        }));
        this.snack.open(`Agent ${r.data.actif ? 'activé' : 'désactivé'}`, 'OK', { duration: 2000 });
      },
      error: () => this.snack.open('Erreur', 'OK', { duration: 2000 })
    });
  }

  reinitialiserMotDePasse(agent: any) {
    this.dialog.open(ConfirmDialogComponent, { data: { title: 'Réinitialiser', message: `Générer un nouveau mot de passe pour ${agent.prenom} ${agent.nom} ?` } })
      .afterClosed().subscribe(ok => {
        if (!ok) return;
        this.api.patch(`boutiques/agents/${agent._id}/reset-password`, {}).subscribe({
          next: (r: any) => {
            this.dialog.open(PasswordResultDialogComponent, {
              data: { nom: `${agent.prenom} ${agent.nom}`, email: agent.email, motDePasseGenere: r.data?.motDePasseGenere },
              maxWidth: '100vw', panelClass: 'produit-dialog-panel',
            });
          },
          error: () => this.snack.open('Erreur lors de la réinitialisation', 'OK', { duration: 3000 })
        });
      });
  }

  supprimerAgent(boutiqueId: string, agent: any) {
    this.dialog.open(ConfirmDialogComponent, { data: { title: 'Supprimer', message: `Supprimer ${agent.prenom} ${agent.nom} ?` } })
      .afterClosed().subscribe(ok => {
        if (!ok) return;
        this.api.delete(`boutiques/agents/${agent._id}`).subscribe({
          next: () => {
            this.agentsMap.update(m => ({ ...m, [boutiqueId]: (m[boutiqueId] || []).filter(a => a._id !== agent._id) }));
            this.boutiques.update(l => l.map(b => b._id === boutiqueId ? { ...b, agentsCount: Math.max(0, (b.agentsCount || 1) - 1) } : b));
            this.snack.open('Agent supprimé', 'OK', { duration: 2000 });
          },
          error: () => this.snack.open('Erreur', 'OK', { duration: 2000 })
        });
      });
  }
}
