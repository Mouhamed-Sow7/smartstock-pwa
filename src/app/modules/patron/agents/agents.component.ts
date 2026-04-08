import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <h1>Gestion des Agents</h1>
      <p>Liste des agents du commerce</p>
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
export class AgentsComponent {}
