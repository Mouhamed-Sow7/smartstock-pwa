import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ClientsService, ClientRelance } from '../../../core/services/clients.service';

// Page "Relances" : clients dont le solde dû arrive à échéance (<=3j) ou est
// déjà en retard. Volontairement en dehors du module patron/agent pour être
// réutilisée telle quelle des deux côtés (mêmes droits API, même besoin).
@Component({
  selector: 'app-relances',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="relances-page">
      <h2>Relances paiement</h2>
      <p class="subtitle" *ngIf="!chargement()">
        {{ clients().length }} client(s) à relancer
      </p>

      <div class="loader" *ngIf="chargement()">
        <mat-icon class="spin">autorenew</mat-icon> Chargement…
      </div>

      <div class="empty" *ngIf="!chargement() && clients().length === 0">
        <mat-icon>check_circle</mat-icon>
        <p>Aucun client à relancer pour l'instant.</p>
      </div>

      <div class="client-card" *ngFor="let c of clients()" [class.retard]="c.statut === 'en_retard'">
        <div class="row-top">
          <span class="nom">{{ c.nom }}</span>
          <span class="badge" [class.retard]="c.statut === 'en_retard'">
            {{ c.statut === 'en_retard' ? ('En retard ' + (-c.joursRestants) + 'j') : ('Dans ' + c.joursRestants + 'j') }}
          </span>
        </div>
        <div class="row-info">
          <span class="solde">{{ c.soldeDu | number:'1.0-0' }} FCFA dus</span>
          <span class="echeance">échéance {{ c.prochaineEcheance | date:'dd/MM/yyyy' }}</span>
        </div>

        <div class="actions">
          <a *ngIf="c.telephone" class="btn-call" [href]="'tel:' + c.telephone">
            <mat-icon>call</mat-icon> Appeler
          </a>
          <button class="btn-pay" (click)="ouvrirPaiement(c)">
            <mat-icon>payments</mat-icon> Encaisser
          </button>
          <button class="btn-postpone" (click)="reporter(c)">
            <mat-icon>event</mat-icon> Reporter 7j
          </button>
        </div>

        <!-- Mini-formulaire d'encaissement, ouvert inline pour rester fluide (pas de modal) -->
        <div class="pay-form" *ngIf="clientEnPaiement()?._id === c._id">
          <input
            type="number"
            inputmode="numeric"
            [(ngModel)]="montantSaisi"
            placeholder="Montant reçu (FCFA)"
            [max]="c.soldeDu"
          />
          <button class="btn-confirm" (click)="confirmerPaiement(c)" [disabled]="!montantSaisi || montantSaisi <= 0">
            Valider
          </button>
          <button class="btn-cancel" (click)="clientEnPaiement.set(null)">Annuler</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .relances-page { padding-bottom: 24px; }
    h2 { color: var(--text-1); font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .subtitle { color: var(--text-3); font-size: 13px; margin-bottom: 16px; }
    .loader, .empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      color: var(--text-3); padding: 40px 0; font-size: 13px;
    }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--accent); }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .client-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 10px;
    }
    .client-card.retard { border-color: rgba(231,76,60,.4); background: rgba(231,76,60,.06); }

    .row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .nom { color: var(--text-1); font-weight: 700; font-size: 15px; }
    .badge {
      font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
      background: rgba(243,156,18,.15); color: var(--warning, #f39c12);
    }
    .badge.retard { background: rgba(231,76,60,.15); color: #e74c3c; }

    .row-info { display: flex; justify-content: space-between; color: var(--text-3); font-size: 12px; margin-bottom: 10px; }
    .solde { font-weight: 600; color: var(--text-2); }

    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions button, .actions a {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 600; padding: 7px 12px; border-radius: 10px;
      border: none; cursor: pointer; text-decoration: none;
    }
    .actions mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .btn-call { background: rgba(46,204,113,.15); color: #2ecc71; }
    .btn-pay { background: var(--accent-lite); color: var(--accent); }
    .btn-postpone { background: rgba(255,255,255,.06); color: var(--text-2); }

    .pay-form { display: flex; gap: 8px; margin-top: 10px; }
    .pay-form input {
      flex: 1; background: var(--navy); border: 1px solid var(--navy-border);
      border-radius: 8px; color: var(--text-1); padding: 8px 10px; font-size: 13px;
    }
    .btn-confirm { background: var(--accent); color: #000; border: none; border-radius: 8px; padding: 0 14px; font-weight: 700; font-size: 12px; }
    .btn-confirm:disabled { opacity: .4; }
    .btn-cancel { background: transparent; color: var(--text-3); border: none; font-size: 12px; }
  `],
})
export class RelancesComponent implements OnInit {
  readonly chargement = signal(true);
  readonly clients = signal<ClientRelance[]>([]);
  readonly clientEnPaiement = signal<ClientRelance | null>(null);
  montantSaisi: number | null = null;

  constructor(private clientsService: ClientsService, private snack: MatSnackBar) {}

  async ngOnInit() {
    await this.charger();
  }

  async charger() {
    this.chargement.set(true);
    await this.clientsService.rafraichirRelances();
    this.clients.set(this.clientsService.relances());
    this.chargement.set(false);
  }

  ouvrirPaiement(c: ClientRelance) {
    this.montantSaisi = c.soldeDu;
    this.clientEnPaiement.set(c);
  }

  async confirmerPaiement(c: ClientRelance) {
    if (!this.montantSaisi || this.montantSaisi <= 0) return;
    try {
      await firstValueFrom(this.clientsService.enregistrerPaiement(c._id, this.montantSaisi));
      this.snack.open(`Paiement de ${this.montantSaisi} FCFA enregistré`, 'OK', { duration: 2500 });
      this.clientEnPaiement.set(null);
      await this.charger();
    } catch {
      this.snack.open("Échec de l'enregistrement du paiement", 'OK', { duration: 3000 });
    }
  }

  async reporter(c: ClientRelance) {
    const nouvelleDate = new Date();
    nouvelleDate.setDate(nouvelleDate.getDate() + 7);
    try {
      await firstValueFrom(this.clientsService.definirEcheance(c._id, nouvelleDate));
      this.snack.open('Relance reportée de 7 jours', 'OK', { duration: 2000 });
      await this.charger();
    } catch {
      this.snack.open('Échec du report', 'OK', { duration: 3000 });
    }
  }
}
