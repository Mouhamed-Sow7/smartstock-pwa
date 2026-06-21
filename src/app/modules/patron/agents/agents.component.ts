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
      h1 {
        font-size: 22px;
        font-weight: 700;
        margin: 0 0 4px;
        color: var(--text-1);
      }
      p {
        color: var(--text-2);
        font-size: 13px;
      }
    `,
  ],
})
export class AgentsComponent {}
