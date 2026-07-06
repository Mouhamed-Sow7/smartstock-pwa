import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
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
  isLoading = false;
  showPassword = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.loginForm = this.fb.group({
      identifiant: ['', [Validators.required, emailOuTelephone]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    const { identifiant, password } = this.loginForm.value;
    const raw = (identifiant || '').trim();

    // ── Accès admin : identifiant "admin" + clé secrète ──────────────────────
    // Pas d'appel API — la clé est stockée en sessionStorage pour que
    // AdminComponent la retrouve et l'envoie dans x-admin-key.
    const ADMIN_IDENTIFIANTS = ['admin', 'smartstock-admin', 'admin@smartstock.sn'];
    if (ADMIN_IDENTIFIANTS.includes(raw.toLowerCase())) {
      sessionStorage.setItem('ss_admin_key', password);
      this.isLoading = false;
      this.router.navigate(['/admin']);
      return;
    }

    // ── Login standard patron / agent ─────────────────────────────────────────
    // Détecter si c'est un téléphone ou un email
    const isTelephone = /^(\+?221|00221)?[7][05678]\d{7}$/.test(raw.replace(/\s/g, ''));
    const payload = isTelephone
      ? { telephone: raw, password }
      : { email: raw, password };

    this.authService.loginRaw(payload).subscribe({
      next: () => {
        this.isLoading = false;
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
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Identifiant ou mot de passe incorrect';
      },
    });
  }
}
