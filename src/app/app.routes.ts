import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./modules/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./modules/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./modules/admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'patron',
    loadChildren: () => import('./modules/patron/patron.module').then((m) => m.PatronModule),
    canActivate: [authGuard],
  },
  {
    path: 'agent',
    loadChildren: () => import('./modules/agent/agent.module').then((m) => m.AgentModule),
    canActivate: [authGuard],
  },
  // '' redirige vers /login par défaut, mais guestGuard (ci-dessus) prend le
  // relais immédiatement pour renvoyer vers /patron ou /agent si un token
  // valide (7j) est déjà présent -> plus besoin de retaper les identifiants
  // à chaque ouverture de la PWA installée tant que la session n'a pas
  // expiré. Voir guest.guard.ts pour le détail de la cause racine.
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
