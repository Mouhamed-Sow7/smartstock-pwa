import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { PatronLayoutComponent } from './patron-layout/patron-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ProduitsComponent } from './produits/produits.component';
import { AgentsComponent } from './agents/agents.component';
import { VentesComponent } from './ventes/ventes.component';

const routes: Routes = [
  {
    path: '',
    component: PatronLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      {
        path: 'produits',
        loadComponent: () =>
          import('./produits/produits.component').then((m) => m.ProduitsComponent),
      },
      {
        path: 'produits/scanner',
        loadComponent: () =>
          import('./produits/scan-ajout/scan-ajout.component').then(
            (m) => m.ScanAjoutComponent,
          ),
      },
      {
        path: 'produits/new',
        loadComponent: () =>
          import('./produits/produit-form.component').then((m) => m.ProduitFormComponent),
      },
      {
        path: 'produits/:id/edit',
        loadComponent: () =>
          import('./produits/produit-form.component').then((m) => m.ProduitFormComponent),
      },
      {
        path: 'agents',
        loadComponent: () => import('./agents/agents.component').then((m) => m.AgentsComponent),
      },
      {
        path: 'ventes',
        loadComponent: () => import('./ventes/ventes.component').then((m) => m.VentesComponent),
      },
      {
        path: 'fournisseurs',
        loadComponent: () =>
          import('./fournisseurs/fournisseurs.component').then((m) => m.FournisseursComponent),
      },
      {
        path: 'prets',
        loadComponent: () =>
          import('../../shared/components/prets-clients/prets-clients.component').then(
            (m) => m.PretsClientsComponent,
          ),
      },
      // Ancienne URL conservée en redirection (au cas où elle serait dans les
      // favoris/raccourcis PWA de l'utilisateur) — même page, nouveau nom.
      { path: 'relances', redirectTo: 'prets', pathMatch: 'full' },
      {
        path: 'compte',
        loadComponent: () =>
          import('./compte/compte.component').then((m) => m.CompteComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    PatronLayoutComponent,
    DashboardComponent,
    ProduitsComponent,
    AgentsComponent,
    VentesComponent,
  ],
})
export class PatronModule {}
