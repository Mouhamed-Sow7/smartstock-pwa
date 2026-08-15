import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Inverse de authGuard : protège /login (et /register) contre un utilisateur
// déjà authentifié avec une session encore valide (token 7j non expiré).
//
// Cause racine de "je dois retaper mes identifiants à chaque ouverture de
// la PWA installée" : app.routes.ts redirige TOUJOURS '' vers '/login'
// (redirectTo statique), et rien ne vérifiait jamais si un token valide
// était déjà présent avant d'afficher le formulaire — même avec un JWT
// valide 7 jours dans localStorage, l'utilisateur retombait sur l'écran de
// connexion à chaque lancement. Ce n'était donc pas un problème de session
// qui expire trop vite, juste une route de destination qui ne regardait
// jamais l'état d'authentification.
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return true;

  const role = auth.getRole();
  if (role === 'patron') router.navigate(['/patron']);
  else if (role === 'agent') router.navigate(['/agent']);
  else return true; // rôle inconnu/absent -> laisser voir le login plutôt que boucler
  // Note : l'admin ne passe jamais par ce flux (JWT/AuthService) — juste une
  // clé sessionStorage posée par login.component.ts, donc role vaut ici
  // 'patron' | 'agent' | '' (jamais 'admin').

  return false;
};
