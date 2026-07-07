import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

function emailValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value || '').trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v) ? null : { email: true };
}

function telephoneValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value || '').trim().replace(/\s/g, '');
  if (!v) return null; // optionnel
  return /^(\+?221|00221)?[7][05678]\d{7}$/.test(v) ? null : { invalidPhone: true };
}

function passwordMatch(form: AbstractControl): ValidationErrors | null {
  const pwd = form.get('password')?.value;
  const confirm = form.get('passwordConfirm')?.value;
  return pwd && confirm && pwd !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
  <div class="register-page">
    <!-- Colonne gauche : hero -->
    <div class="hero">
      <div class="hero-inner">
        <div class="logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#00b894"/>
            <path d="M10 28l6-8 5 6 4-5 5 7H10z" fill="white" opacity=".9"/>
            <circle cx="28" cy="14" r="4" fill="white" opacity=".85"/>
          </svg>
          <span>SmartStock</span>
        </div>
        <h1>Créez votre espace boutique</h1>
        <p class="hero-sub">Gérez votre stock, vos ventes et vos agents depuis votre téléphone. Fonctionne même sans connexion.</p>
        <div class="features">
          <div class="feature"><i class="fa-solid fa-wifi-slash"></i><span>Ventes hors-ligne</span></div>
          <div class="feature"><i class="fa-solid fa-barcode"></i><span>Scan code-barres</span></div>
          <div class="feature"><i class="fa-solid fa-chart-line"></i><span>Suivi des marges</span></div>
          <div class="feature"><i class="fa-brands fa-mobile-screen-button"></i><span>Wave / Orange Money</span></div>
        </div>
        <div class="already">
          Déjà un compte ? <a routerLink="/login">Se connecter</a>
        </div>
      </div>
    </div>

    <!-- Colonne droite : formulaire -->
    <div class="form-col">
      <div class="form-wrap">
        <div class="form-header">
          <h2>Créer mon compte</h2>
          <p>Gratuit — prêt en 30 secondes</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <!-- Nom du patron -->
          <div class="field-group">
            <label>Votre nom complet</label>
            <div class="input-wrap">
              <i class="fa-solid fa-user"></i>
              <input formControlName="nom" type="text" placeholder="Mamadou Diallo" autocomplete="name" />
            </div>
            <span class="field-error" *ngIf="form.get('nom')?.invalid && form.get('nom')?.touched">Nom requis</span>
          </div>

          <!-- Nom boutique -->
          <div class="field-group">
            <label>Nom de votre boutique</label>
            <div class="input-wrap">
              <i class="fa-solid fa-store"></i>
              <input formControlName="boutique" type="text" placeholder="Mini Market Liberté 6" autocomplete="organization" />
            </div>
            <span class="field-error" *ngIf="form.get('boutique')?.invalid && form.get('boutique')?.touched">Nom de boutique requis</span>
          </div>

          <!-- Email -->
          <div class="field-group">
            <label>Email</label>
            <div class="input-wrap">
              <i class="fa-solid fa-envelope"></i>
              <input formControlName="email" type="email" placeholder="mamadou@minimarket.com" autocomplete="email" />
            </div>
            <span class="field-error" *ngIf="form.get('email')?.invalid && form.get('email')?.touched">Email invalide</span>
          </div>

          <!-- Téléphone -->
          <div class="field-group">
            <label>Téléphone <span class="hint-label">(optionnel — identifiant de connexion rapide)</span></label>
            <div class="input-wrap">
              <i class="fa-solid fa-mobile-screen-button"></i>
              <input formControlName="telephone" type="tel" placeholder="77 123 45 67" autocomplete="tel" />
            </div>
            <span class="field-error" *ngIf="form.get('telephone')?.errors?.['invalidPhone']">Numéro sénégalais invalide (ex: 77 123 45 67)</span>
          </div>

          <!-- Mot de passe -->
          <div class="field-group">
            <label>Mot de passe <span class="hint-label">(min 6 caractères)</span></label>
            <div class="input-wrap">
              <i class="fa-solid fa-lock"></i>
              <input formControlName="password" [type]="showPassword ? 'text' : 'password'" placeholder="••••••••" autocomplete="new-password" />
              <button type="button" class="toggle-pwd" (click)="showPassword = !showPassword" tabindex="-1">
                <i [class]="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              </button>
            </div>
          </div>

          <!-- Confirmer mdp -->
          <div class="field-group">
            <label>Confirmer le mot de passe</label>
            <div class="input-wrap">
              <i class="fa-solid fa-lock-open"></i>
              <input formControlName="passwordConfirm" [type]="showPassword ? 'text' : 'password'" placeholder="••••••••" autocomplete="new-password" />
            </div>
            <span class="field-error" *ngIf="form.hasError('mismatch') && form.get('passwordConfirm')?.touched">Les mots de passe ne correspondent pas</span>
          </div>

          <!-- Erreur serveur -->
          <div class="server-error" *ngIf="errorMessage">
            <i class="fa-solid fa-triangle-exclamation"></i>
            {{ errorMessage }}
          </div>

          <!-- Succès -->
          <div class="server-success" *ngIf="successMessage">
            <i class="fa-solid fa-check-circle"></i>
            {{ successMessage }}
          </div>

          <button type="submit" class="btn-submit" [disabled]="form.invalid || isLoading">
            <span *ngIf="!isLoading">
              <i class="fa-solid fa-rocket"></i>
              Créer mon espace boutique
            </span>
            <span *ngIf="isLoading" class="spinner-wrap">
              <span class="spinner"></span> Création en cours...
            </span>
          </button>
        </form>

        <div class="cgu">
          En créant un compte, vous acceptez nos <a href="#">Conditions d'utilisation</a>.
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .register-page {
      display: flex;
      min-height: 100dvh;
      background: var(--navy);
    }

    /* ── Hero ── */
    .hero {
      flex: 1;
      background: linear-gradient(145deg, #0a1628 0%, #0f2340 60%, #0d1f38 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 40px;
    }
    .hero-inner { max-width: 420px; }
    .logo {
      display: flex; align-items: center; gap: 10px;
      font-size: 22px; font-weight: 800; color: #ffffff;
      margin-bottom: 32px;
    }
    .hero h1 {
      font-size: 28px; font-weight: 800; color: #ffffff;
      line-height: 1.2; margin-bottom: 14px;
    }
    .hero-sub { font-size: 15px; color: rgba(255,255,255,.6); line-height: 1.6; margin-bottom: 32px; }
    .features { display: flex; flex-direction: column; gap: 12px; margin-bottom: 36px; }
    .feature { display: flex; align-items: center; gap: 12px; font-size: 14px; color: rgba(255,255,255,.75); }
    .feature i { color: #00b894; width: 18px; text-align: center; font-size: 15px; }
    .already { font-size: 13px; color: rgba(255,255,255,.45); }
    .already a { color: #00b894; text-decoration: none; font-weight: 600; }
    .already a:hover { text-decoration: underline; }

    /* ── Formulaire ── */
    .form-col {
      flex: 0 0 480px;
      background: var(--navy-light, #162236);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
    }
    .form-wrap { width: 100%; max-width: 380px; }
    .form-header { margin-bottom: 28px; }
    .form-header h2 { font-size: 22px; font-weight: 800; color: var(--text-1); margin: 0 0 4px; }
    .form-header p { font-size: 13px; color: var(--text-3); margin: 0; }

    .field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .field-group label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-2); }
    .hint-label { font-size: 10px; text-transform: none; letter-spacing: 0; font-weight: 400; color: var(--text-3); }
    .input-wrap {
      position: relative; display: flex; align-items: center;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px; overflow: hidden; transition: border-color .15s;
    }
    .input-wrap:focus-within { border-color: #00b894; }
    .input-wrap i { padding: 0 12px; color: rgba(255,255,255,.35); font-size: 14px; flex-shrink: 0; }
    .input-wrap input {
      flex: 1; background: none; border: none; outline: none;
      padding: 13px 12px 13px 0; color: var(--text-1); font-size: 15px;
    }
    .input-wrap input::placeholder { color: rgba(255,255,255,.25); }
    .toggle-pwd {
      padding: 0 12px; background: none; border: none;
      color: rgba(255,255,255,.35); cursor: pointer; font-size: 14px;
    }
    .field-error { font-size: 11px; color: #e74c3c; }

    .server-error {
      background: rgba(231,76,60,.12); border: 1px solid rgba(231,76,60,.3);
      border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #e74c3c;
      display: flex; align-items: center; gap: 8px; margin-bottom: 14px;
    }
    .server-success {
      background: rgba(0,184,148,.1); border: 1px solid rgba(0,184,148,.3);
      border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #00b894;
      display: flex; align-items: center; gap: 8px; margin-bottom: 14px;
    }

    .btn-submit {
      width: 100%; padding: 14px; border: none; border-radius: 10px;
      background: #00b894; color: #04241c; font-size: 15px; font-weight: 700;
      cursor: pointer; transition: background .15s; display: flex;
      align-items: center; justify-content: center; gap: 8px; margin-top: 4px;
    }
    .btn-submit:hover:not(:disabled) { background: #00a382; }
    .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
    .spinner-wrap { display: flex; align-items: center; gap: 8px; }
    .spinner {
      width: 16px; height: 16px; border: 2px solid rgba(4,36,28,.3);
      border-top-color: #04241c; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .cgu { margin-top: 16px; font-size: 11px; color: var(--text-3); text-align: center; }
    .cgu a { color: #00b894; text-decoration: none; }

    /* ── Light mode ── */
    [data-theme="light"] .hero {
      background: linear-gradient(145deg, #0f2340 0%, #1a3a5c 60%, #163055 100%);
    }
    [data-theme="light"] .form-col { background: #ffffff; }
    [data-theme="light"] .input-wrap {
      background: #f0f4f8; border-color: #c5d0df;
    }
    [data-theme="light"] .input-wrap i { color: #9aafc4; }
    [data-theme="light"] .input-wrap input { color: #0d1b2a; }
    [data-theme="light"] .input-wrap input::placeholder { color: #b0c0d0; }
    [data-theme="light"] .input-wrap:focus-within { border-color: #00966e; }
    [data-theme="light"] .toggle-pwd { color: #9aafc4; }

    /* ── Responsive mobile ── */
    @media (max-width: 768px) {
      .register-page { flex-direction: column; }
      .hero {
        padding: 32px 24px 24px;
        flex: none;
      }
      .hero h1 { font-size: 22px; }
      .hero-sub { display: none; }
      .features { display: none; }
      .form-col { flex: 1; padding: 24px 16px; }
    }
  `]
})
export class RegisterComponent {
  form: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
  ) {
    this.form = this.fb.group({
      nom:             ['', Validators.required],
      boutique:        ['', Validators.required],
      email:           ['', [Validators.required, emailValidator]],
      telephone:       ['', [telephoneValidator]],
      password:        ['', [Validators.required, Validators.minLength(6)]],
      passwordConfirm: ['', Validators.required],
    }, { validators: passwordMatch });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    const { nom, boutique, email, telephone, password } = this.form.value;

    this.http.post(`${environment.apiUrl}/auth/register`, { nom, boutique, email, telephone, password })
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          if (res?.success) {
            // Stocker le token et rediriger vers le dashboard patron
            localStorage.setItem('ss_token', res.token);
            localStorage.setItem('ss_user', JSON.stringify(res.user));
            this.successMessage = `Bienvenue ${res.user.nom} ! Redirection...`;
            setTimeout(() => this.router.navigate(['/patron']), 1000);
          } else {
            this.errorMessage = res?.message || 'Erreur lors de la création';
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.message || 'Erreur réseau — réessayez';
        }
      });
  }
}
