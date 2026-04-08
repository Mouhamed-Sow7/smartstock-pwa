import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AgentLayoutComponent } from './agent-layout/agent-layout.component';
import { ScanComponent } from './scan/scan.component';
import { PanierComponent } from './panier/panier.component';
import { TicketComponent } from './ticket/ticket.component';
import { AgentDashboardComponent } from './dashboard/agent-dashboard.component';
const routes: Routes = [
  {
    path: '',
    component: AgentLayoutComponent,
    children: [
      { path: 'dashboard', component: AgentDashboardComponent },
      { path: 'scan', component: ScanComponent },
      { path: 'panier', component: PanierComponent },
      { path: 'ticket', component: TicketComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    AgentLayoutComponent,
    AgentDashboardComponent,
    ScanComponent,
    PanierComponent,
    TicketComponent,
  ],
})
export class AgentModule {}
