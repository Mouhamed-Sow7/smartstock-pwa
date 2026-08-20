import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = `${environment.apiUrl}/auth`;
  private TOKEN_KEY = 'ss_token';
  private USER_KEY = 'ss_user';

  // Callback appelé après un login réussi — injecté par SyncService pour
  // éviter la dépendance circulaire (AuthService <-> SyncService)
  onLoginSuccess?: () => void;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(email: string, password: string) {
    return this.loginRaw({ email, password });
  }

  // loginRaw accepte n'importe quel payload { email?, telephone?, password }
  // pour gérer à la fois les patrons (email) et les agents (email @slug.sm ou téléphone)
  loginRaw(payload: { email?: string; telephone?: string; password: string }) {
    return this.http.post<any>(`${this.baseUrl}/login`, payload).pipe(
      tap((res) => {
        if (res.token) {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.user || res));
          setTimeout(() => this.onLoginSuccess?.(), 500);
        }
      }),
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): any {
    const u = localStorage.getItem(this.USER_KEY);
    try {
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  getRole(): string {
    return this.getUser()?.role || '';
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getTenantId(): string {
    return this.getUser()?.tenantId || 'default';
  }

  // Ré-interroge le profil serveur et rafraîchit le cache localStorage.
  // Cause racine du bug "l'admin change le nom de boutique mais le patron/
  // agent ne le voit jamais" : user?.boutique est lu depuis un snapshot
  // localStorage figé au moment du login (ss_user), jamais revalidé tant
  // que la session reste ouverte. Le backend avait déjà un endpoint
  // GET /auth/me pour ça (auth.controller.js getProfile), mais rien côté
  // frontend ne l'appelait. Appelé au chargement de chaque layout
  // (patron/agent) pour rattraper tout changement fait côté admin entre
  // deux sessions, sans attendre une déconnexion/reconnexion.
  // Retourne l'utilisateur à jour (ou le cache existant si offline/erreur —
  // ne casse jamais le mode offline-first pour un simple souci réseau).
  refreshUser() {
    return this.http.get<any>(`${this.baseUrl}/me`).pipe(
      tap((res) => {
        const user = res?.data || res;
        if (user) localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
      catchError(() => of(this.getUser())),
    );
  }

  // Page "Mon compte" patron : modifie nom/email/téléphone/boutique. Le
  // backend cascade automatiquement un renommage de boutique (voir
  // utils/boutiqueRename.js côté smartStock) -- la réponse peut inclure
  // emailsChanges si des agents ont eu leur email relocalisé suite au
  // changement de slug, à afficher clairement au patron pour qu'il prévienne
  // son équipe (pas de notification automatique par email/SMS pour l'instant).
  updateProfil(payload: { nom?: string; email?: string; telephone?: string; boutique?: string; seuilExpirationJours?: number }) {
    return this.http.patch<any>(`${this.baseUrl}/profil`, payload).pipe(
      tap((res) => {
        if (res?.data) localStorage.setItem(this.USER_KEY, JSON.stringify(res.data));
      }),
    );
  }

  changePassword(ancienMotDePasse: string, nouveauMotDePasse: string) {
    return this.http.patch<any>(`${this.baseUrl}/change-password`, { ancienMotDePasse, nouveauMotDePasse });
  }
}
