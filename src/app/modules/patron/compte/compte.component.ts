import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-compte',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="compte-page">
      <div class="page-header">
        <h1>Mon compte</h1>
        <p class="page-sub">Modifiez vos informations. Un email ou téléphone bloqué ? Vous pouvez le changer vous-même ici, sans passer par l'administrateur.</p>
      </div>

      <!-- Emails agents relocalisés après un renommage de boutique -->
      @if (emailsChanges().length > 0) {
        <div class="alert-box">
          <mat-icon>warning</mat-icon>
          <div>
            <strong>Important : les identifiants de connexion de {{ emailsChanges().length }} agent(s) ont changé</strong>
            <p>Le renommage de la boutique a automatiquement mis à jour leurs emails de connexion. Prévenez-les avec leur nouvel identifiant :</p>
            <ul>
              @for (c of emailsChanges(); track c.agentId) {
                <li><span class="old-email">{{ c.ancienEmail }}</span> → <span class="new-email">{{ c.nouvelEmail }}</span></li>
              }
            </ul>
            <p class="alert-note">Leur mot de passe ne change pas, seul l'identifiant de connexion.</p>
          </div>
        </div>
      }

      <!-- Profil -->
      <form class="dlg-card" [formGroup]="profilForm" (ngSubmit)="enregistrerProfil()">
        <h2 class="card-title"><mat-icon>store</mat-icon> Informations</h2>

        <div class="field-group">
          <label class="field-label">Nom de la boutique</label>
          <input class="field-input" formControlName="boutique" placeholder="Ex: Épicerie Al Amine" />
        </div>

        <div class="fields-row">
          <div class="field-group">
            <label class="field-label">Votre nom</label>
            <input class="field-input" formControlName="nom" />
          </div>
          <div class="field-group">
            <label class="field-label">Téléphone</label>
            <input class="field-input" type="tel" formControlName="telephone" placeholder="77 123 45 67" />
            <span class="field-hint">Permet de vous connecter par numéro en plus de l'email.</span>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Email</label>
          <input class="field-input" type="email" formControlName="email" [class.error]="profilForm.get('email')?.invalid && profilForm.get('email')?.touched" />
          <span class="field-error" *ngIf="profilForm.get('email')?.invalid && profilForm.get('email')?.touched">Email invalide</span>
        </div>

        @if (profilError()) {
          <div class="form-error">{{ profilError() }}</div>
        }
        @if (profilSuccess()) {
          <div class="form-success"><mat-icon>check_circle</mat-icon> Informations mises à jour.</div>
        }

        <button type="submit" class="btn-save" [disabled]="profilForm.invalid || profilSaving()">
          {{ profilSaving() ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </form>

      <!-- Mot de passe -->
      <form class="dlg-card" [formGroup]="pwdForm" (ngSubmit)="changerMotDePasse()">
        <h2 class="card-title"><mat-icon>lock</mat-icon> Mot de passe</h2>

        <div class="field-group">
          <label class="field-label">Mot de passe actuel</label>
          <input class="field-input" type="password" formControlName="ancien" />
        </div>
        <div class="field-group">
          <label class="field-label">Nouveau mot de passe</label>
          <input class="field-input" type="password" formControlName="nouveau" placeholder="Au moins 6 caractères" />
        </div>

        @if (pwdError()) {
          <div class="form-error">{{ pwdError() }}</div>
        }
        @if (pwdSuccess()) {
          <div class="form-success"><mat-icon>check_circle</mat-icon> Mot de passe modifié.</div>
        }

        <button type="submit" class="btn-save" [disabled]="pwdForm.invalid || pwdSaving()">
          {{ pwdSaving() ? 'Enregistrement...' : 'Changer le mot de passe' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .compte-page { max-width: 560px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 20px; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: var(--text-1); margin: 0 0 4px; }
    .page-sub { font-size: 13px; color: var(--text-3); margin: 0; line-height: 1.4; }

    .alert-box {
      display: flex; gap: 10px; background: rgba(243,156,18,.1); border: 1px solid rgba(243,156,18,.3);
      border-radius: 12px; padding: 14px; color: var(--text-2); font-size: 13px;
    }
    .alert-box mat-icon { color: #f39c12; flex-shrink: 0; }
    .alert-box strong { color: var(--text-1); display: block; margin-bottom: 4px; }
    .alert-box ul { margin: 8px 0; padding-left: 18px; }
    .alert-box li { margin-bottom: 4px; }
    .old-email { color: var(--text-3); text-decoration: line-through; }
    .new-email { color: #00b894; font-weight: 700; }
    .alert-note { font-size: 11px; color: var(--text-3); margin: 8px 0 0; }

    .dlg-card {
      background: var(--navy-card); border: 1px solid var(--navy-border); border-radius: 16px;
      padding: 20px; display: flex; flex-direction: column; gap: 14px;
    }
    .card-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--text-1); margin: 0; }
    .card-title mat-icon { color: var(--accent); font-size: 20px; width: 20px; height: 20px; }

    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--text-3); }
    .field-input {
      width: 100%; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px; padding: 10px 12px; color: var(--text-1); font-size: 16px; outline: none;
      transition: border-color .15s; box-sizing: border-box;
    }
    .field-input:focus { border-color: #00b894; }
    .field-input.error { border-color: #e74c3c; }
    .field-hint { font-size: 11px; color: var(--text-3); }
    .field-error { font-size: 11px; color: #e74c3c; }
    .fields-row { display: flex; gap: 10px; }
    .fields-row .field-group { flex: 1; min-width: 0; }

    .form-error { font-size: 13px; color: #e74c3c; background: rgba(231,76,60,.1); border-radius: 8px; padding: 8px 12px; }
    .form-success { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #00b894; }
    .form-success mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .btn-save {
      background: var(--accent); color: #fff; border: none; border-radius: 10px; padding: 12px;
      font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s;
    }
    .btn-save:disabled { opacity: .5; cursor: default; }
  `],
})
export class CompteComponent {
  // Signals : app zoneless (voir login.component.ts pour le détail), les
  // mutations d'état dans les callbacks subscribe() ci-dessous ont besoin
  // de signals pour se refléter dans la vue.
  profilSaving = signal(false);
  profilError = signal('');
  profilSuccess = signal(false);
  emailsChanges = signal<{ agentId: string; ancienEmail: string; nouvelEmail: string }[]>([]);

  pwdSaving = signal(false);
  pwdError = signal('');
  pwdSuccess = signal(false);

  profilForm: FormGroup;
  pwdForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private snack: MatSnackBar,
  ) {
    const user = this.auth.getUser();
    this.profilForm = this.fb.group({
      boutique: [user?.boutique || ''],
      nom: [user?.nom || ''],
      telephone: [this.formaterTelephone(user?.telephone)],
      email: [user?.email || '', [Validators.required, Validators.email]],
    });
    this.pwdForm = this.fb.group({
      ancien: ['', Validators.required],
      nouveau: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  // Affichage lisible du téléphone normalisé stocké en base
  // ("221771234567" -> "+221 77 123 45 67"). Purement pour pré-remplir le
  // champ ; à la sauvegarde le backend re-normalise de toute façon
  // (normaliserTelephone accepte les deux formats en entrée).
  private formaterTelephone(normalise: string | undefined): string {
    if (!normalise || normalise.length !== 12) return normalise || '';
    const local = normalise.slice(3);
    return `+221 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }

  enregistrerProfil(): void {
    if (this.profilForm.invalid) return;
    this.profilSaving.set(true);
    this.profilError.set('');
    this.profilSuccess.set(false);
    this.emailsChanges.set([]);

    this.auth.updateProfil(this.profilForm.value).subscribe({
      next: (res) => {
        this.profilSaving.set(false);
        this.profilSuccess.set(true);
        if (res?.emailsChanges?.length) {
          this.emailsChanges.set(res.emailsChanges);
          this.snack.open(
            `⚠ ${res.emailsChanges.length} email(s) agent modifié(s) — voir ci-dessus`,
            '✕',
            { duration: 6000, panelClass: 'snack-warn' },
          );
        } else {
          this.snack.open('✓ Informations mises à jour', '✕', { duration: 3000, panelClass: 'snack-success' });
        }
      },
      error: (err) => {
        this.profilSaving.set(false);
        this.profilError.set(err.error?.message || 'Erreur lors de la mise à jour');
      },
    });
  }

  changerMotDePasse(): void {
    if (this.pwdForm.invalid) return;
    this.pwdSaving.set(true);
    this.pwdError.set('');
    this.pwdSuccess.set(false);

    const { ancien, nouveau } = this.pwdForm.value;
    this.auth.changePassword(ancien, nouveau).subscribe({
      next: () => {
        this.pwdSaving.set(false);
        this.pwdSuccess.set(true);
        this.pwdForm.reset();
        this.snack.open('✓ Mot de passe modifié', '✕', { duration: 3000, panelClass: 'snack-success' });
      },
      error: (err) => {
        this.pwdSaving.set(false);
        this.pwdError.set(err.error?.message || 'Erreur lors du changement de mot de passe');
      },
    });
  }
}
