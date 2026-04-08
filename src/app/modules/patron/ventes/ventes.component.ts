import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-ventes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <h1>Historique des Ventes</h1>
      <p>Liste des ventes du commerce</p>
    </div>
  `,
  styles: [
    `
      .page-container {
        padding: 16px;
      }
    `,
  ],
})
export class VentesComponent {}
