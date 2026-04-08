import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./modules/auth/login/login.component').then((m) => m.LoginComponent),
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
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
