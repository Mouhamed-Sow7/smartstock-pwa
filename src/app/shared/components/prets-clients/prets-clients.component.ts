import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ClientsService, ClientCredit } from '../../../core/services/clients.service';

// Page "Prêts clients" : todo-list des clients ayant reçu de la marchandise
// à crédit. Coché = remboursé, décoché = pas encore. Volontairement SANS
// notion d'échéance/relance programmée (ancienne version) : le patron
// n'a besoin que de savoir qui doit encore payer, pas d'un calendrier de
// rappels. Le client n'est jamais notifié — cette liste n'est visible que
// par le patron connecté (mêmes droits API que le reste de l'app).
@Component({
  selector: 'app-prets-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="prets-page">
      <h2>Prêts clients</h2>
      <p class="subtitle" *ngIf="!chargement()">
        {{ nonRembourses().length }} en attente de remboursement · {{ rembourses().length }} soldé(s)
      </p>
      <p class="note">
        <mat-icon>lock</mat-icon>
        Visible par vous uniquement — vos clients ne reçoivent aucune notification.
      </p>

      <div class="loader" *ngIf="chargement()">
        <mat-icon class="spin">autorenew</mat-icon> Chargement…
      </div>

      <div class="empty" *ngIf="!chargement() && clients().length === 0">
        <mat-icon>check_circle</mat-icon>
        <p>Aucun prêt client pour l'instant.</p>
        <p class="empty-sub">
          Un prêt est créé automatiquement quand une vente est validée en mode « Crédit ».
        </p>
      </div>

      <!-- À rembourser -->
      <div class="section" *ngIf="!chargement() && nonRembourses().length > 0">
        <div class="section-title">À rembourser</div>
        <div class="client-card" *ngFor="let c of nonRembourses()">
          <div class="card-top">
            <div class="card-identity">
              <span class="nom">{{ c.nom }}</span>
              <a *ngIf="c.telephone" class="btn-call" [href]="'tel:' + c.telephone">
                <mat-icon>call</mat-icon> {{ c.telephone }}
              </a>
            </div>
            <span class="solde">{{ c.soldeDu | number:'1.0-0' }} FCFA</span>
          </div>

          <!-- Formulaire d'encaissement, ouvert inline pour rester fluide (pas de modal) -->
          <div class="pay-form" *ngIf="clientEnPaiement()?._id === c._id">
            <label class="pay-label">Montant reçu</label>
            <div class="pay-input-row">
              <input
                type="number"
                inputmode="numeric"
                [(ngModel)]="montantSaisi"
                placeholder="Ex : {{ c.soldeDu }}"
                [max]="c.soldeDu"
              />
              <span class="pay-unit">FCFA</span>
            </div>
            <div class="pay-actions">
              <button class="btn-cancel" (click)="annulerPaiement(c)">Annuler</button>
              <button class="btn-confirm" (click)="confirmerPaiement(c)" [disabled]="!montantSaisi || montantSaisi <= 0">
                <mat-icon>check</mat-icon> Confirmer le paiement
              </button>
            </div>
          </div>

          <button
            class="btn-mark-paid"
            *ngIf="clientEnPaiement()?._id !== c._id"
            (click)="ouvrirPaiement(c)"
          >
            <mat-icon>task_alt</mat-icon> Marquer remboursé
          </button>
        </div>
      </div>

      <!-- Remboursés -->
      <div class="section" *ngIf="!chargement() && rembourses().length > 0">
        <button class="toggle-rembourses" (click)="voirRembourses.set(!voirRembourses())">
          <mat-icon>{{ voirRembourses() ? 'expand_less' : 'expand_more' }}</mat-icon>
          {{ rembourses().length }} client(s) soldé(s)
        </button>
        <ng-container *ngIf="voirRembourses()">
          <div class="client-card done" *ngFor="let c of rembourses()">
            <div class="card-top">
              <div class="card-identity">
                <span class="nom">{{ c.nom }}</span>
              </div>
              <span class="solde ok"><mat-icon>check_circle</mat-icon> Remboursé</span>
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .prets-page { padding-bottom: 24px; }
    h2 { color: var(--text-1); font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .subtitle { color: var(--text-3); font-size: 13px; margin-bottom: 8px; }
    .note {
      display: flex; align-items: center; gap: 6px;
      color: var(--text-3); font-size: 11px; margin-bottom: 16px;
    }
    .note mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .loader, .empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      color: var(--text-3); padding: 40px 0; font-size: 13px; text-align: center;
    }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--accent); }
    .empty-sub { font-size: 11px; color: var(--text-3); max-width: 280px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .section { margin-bottom: 20px; }
    .section-title {
      color: var(--text-3); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .6px; margin-bottom: 8px;
    }

    .client-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 10px;
    }
    .client-card.done { opacity: .65; }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .card-identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .nom { color: var(--text-1); font-weight: 700; font-size: 15px; }
    .solde { color: var(--warning, #f39c12); font-weight: 800; font-size: 15px; white-space: nowrap; flex-shrink: 0; }
    .solde.ok {
      display: inline-flex; align-items: center; gap: 4px;
      color: var(--accent); font-size: 12px; font-weight: 600;
    }
    .solde.ok mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .btn-call {
      display: inline-flex; align-items: center; gap: 4px;
      color: #2ecc71; font-size: 12px; text-decoration: none; width: fit-content;
    }
    .btn-call mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Bouton d'action principal, pleine largeur, sans ambiguïté (remplace
       l'ancienne case à cocher qui se chevauchait avec le nom sur mobile) */
    .btn-mark-paid {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      width: 100%; margin-top: 12px;
      background: transparent;
      border: 1.5px dashed var(--navy-border);
      color: var(--text-2);
      border-radius: 10px;
      padding: 10px;
      font-size: 13px; font-weight: 600;
      cursor: pointer;
    }
    .btn-mark-paid mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .btn-mark-paid:active { background: var(--navy); }

    /* Formulaire de paiement : bloc pleine largeur sous le nom, jamais
       collé à côté du texte pour rester lisible sur petit écran */
    .pay-form {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--navy-border);
    }
    .pay-label { display: block; color: var(--text-3); font-size: 11px; font-weight: 600; margin-bottom: 6px; }
    .pay-input-row {
      display: flex; align-items: center; gap: 8px;
      background: var(--navy); border: 1px solid var(--navy-border);
      border-radius: 10px; padding: 2px 12px;
    }
    .pay-input-row input {
      flex: 1; min-width: 0; background: transparent; border: none;
      color: var(--text-1); padding: 10px 0; font-size: 15px; font-weight: 600;
    }
    .pay-input-row input:focus { outline: none; }
    .pay-unit { color: var(--text-3); font-size: 12px; font-weight: 600; flex-shrink: 0; }

    .pay-actions { display: flex; gap: 8px; margin-top: 10px; }
    .btn-confirm {
      flex: 1;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      background: var(--accent); color: #04241c; border: none;
      border-radius: 10px; padding: 11px; font-weight: 700; font-size: 13px;
      cursor: pointer;
    }
    .btn-confirm mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .btn-confirm:disabled { opacity: .4; }
    .btn-cancel {
      background: transparent; color: var(--text-3);
      border: 1px solid var(--navy-border); border-radius: 10px;
      padding: 11px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
    }

    .toggle-rembourses {
      display: flex; align-items: center; gap: 4px;
      background: transparent; border: none; color: var(--text-3);
      font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 0 10px;
    }
    .toggle-rembourses mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class PretsClientsComponent implements OnInit {
  readonly chargement = signal(true);
  readonly clients = signal<ClientCredit[]>([]);
  readonly clientEnPaiement = signal<ClientCredit | null>(null);
  readonly voirRembourses = signal(false);
  montantSaisi: number | null = null;

  readonly nonRembourses = computed(() => this.clients().filter((c) => c.soldeDu > 0));
  readonly rembourses = computed(() => this.clients().filter((c) => c.soldeDu <= 0));

  constructor(private clientsService: ClientsService, private snack: MatSnackBar) {}

  async ngOnInit() {
    await this.charger();
  }

  async charger() {
    this.chargement.set(true);
    await this.clientsService.rafraichirCredits();
    this.clients.set(this.clientsService.clientsCredit());
    this.chargement.set(false);
  }

  ouvrirPaiement(c: ClientCredit) {
    this.montantSaisi = c.soldeDu;
    this.clientEnPaiement.set(c);
  }

  annulerPaiement(c: ClientCredit) {
    this.clientEnPaiement.set(null);
  }

  async confirmerPaiement(c: ClientCredit) {
    if (!this.montantSaisi || this.montantSaisi <= 0) return;
    try {
      await firstValueFrom(this.clientsService.enregistrerPaiement(c._id, this.montantSaisi));
      this.snack.open(`${c.nom} marqué comme remboursé`, 'OK', { duration: 2500 });
      this.clientEnPaiement.set(null);
      await this.charger();
    } catch {
      this.snack.open("Échec de l'enregistrement du paiement", 'OK', { duration: 3000 });
    }
  }
}
