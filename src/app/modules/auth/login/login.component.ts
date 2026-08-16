import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

// Regex permissive : accepte email classique + agents (@slug.sm) + téléphone sénégalais + identifiants admin courts
function emailOuTelephone(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value || '').trim();
  if (!v) return null;
  // identifiants admin (admin, smartstock-admin, etc.)
  if (['admin', 'smartstock-admin', 'admin@smartstock.sn'].includes(v.toLowerCase())) return null;
  // email standard ou @domaine.xx (2-5 chars)
  const emailOk = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v);
  // téléphone sénégalais : 9 chiffres commençant par 7, ou avec +221/00221
  const telOk = /^(\+?221|00221)?[7][05678]\d{7}$/.test(v.replace(/\s/g, ''));
  return emailOk || telOk ? null : { emailOuTelephone: true };
}

// Doit rester rigoureusement identique à normaliserTelephone() dans
// register.component.ts : le login envoie exactement le même format que
// celui stocké à l'inscription, quelle que soit la façon dont l'utilisateur
// tape son numéro (avec/sans espaces, avec/sans +221).
function normaliserTelephone(v: string): string {
  const digits = (v || '').replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginForm: FormGroup;
  // Signals (pas de simples booléens/strings) : l'app tourne sans zone.js
  // (zoneless, voir app.config.ts — aucune dépendance zone.js dans
  // package.json). Muter un champ de classe classique depuis un callback
  // async (ex: subscribe() d'une requête HTTP) ne déclenche PAS de
  // rafraîchissement automatique de la vue en zoneless -> c'était la cause
  // du bug "ça charge indéfiniment jusqu'à ce que je clique sur la page"
  // (le clic forçait un cycle de détection qui révélait l'état déjà à
  // jour, calculé silencieusement depuis la réponse HTTP). Un signal, lui,
  // notifie le scheduler automatiquement à chaque mutation, peu importe le
  // contexte (même pattern déjà utilisé correctement dans ThemeService et
  // SyncService).
  isLoading = signal(false);
  showPassword = false;
  errorMessage = signal('');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.loginForm = this.fb.group({
      identifiant: ['', [Validators.required, emailOuTelephone]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });
    // ⚠️ Ne PAS appeler this.theme.set('dark') ici : la page login est
    // entièrement codée en dur en sombre (couleurs hex directes, voir
    // login.component.scss), donc ça n'avait aucun effet visuel sur cette
    // page. En revanche ThemeService.set() écrit dans localStorage ->
    // ça écrasait silencieusement le thème clair (ou tout choix utilisateur)
    // pour TOUT le reste de l'app (patron/agent) à chaque passage sur /login,
    // y compris à chaque déconnexion. C'était la vraie cause racine du "l'app
    // démarre toujours en sombre" — pas un problème de cache/déploiement.
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;
    this.isLoading.set(true);
    this.errorMessage.set('');
    const { identifiant, password } = this.loginForm.value;
    const raw = (identifiant || '').trim();

    // ── Accès admin : identifiant "admin" + clé secrète ──────────────────────
    // Pas d'appel API — la clé est stockée en sessionStorage pour que
    // AdminComponent la retrouve et l'envoie dans x-admin-key.
    const ADMIN_IDENTIFIANTS = ['admin', 'smartstock-admin', 'admin@smartstock.sn'];
    if (ADMIN_IDENTIFIANTS.includes(raw.toLowerCase())) {
      sessionStorage.setItem('ss_admin_key', password);
      this.isLoading.set(false);
      this.router.navigate(['/admin']);
      return;
    }

    // ── Login standard patron / agent ─────────────────────────────────────────
    // Détecter si c'est un téléphone ou un email
    const isTelephone = /^(\+?221|00221)?[7][05678]\d{7}$/.test(raw.replace(/\s/g, ''));
    const payload = isTelephone ? { telephone: normaliserTelephone(raw), password } : { email: raw, password };

    this.authService.loginRaw(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        const user = this.authService.getUser();
        if (user?.role === 'patron') {
          this.router.navigate(['/patron']);
        } else if (user?.role === 'agent') {
          this.router.navigate(['/agent']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (error: any) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.error?.message || 'Identifiant ou mot de passe incorrect');
      },
    });
  }
}
