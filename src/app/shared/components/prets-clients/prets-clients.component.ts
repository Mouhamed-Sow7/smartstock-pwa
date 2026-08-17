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
        <div class="client-row" *ngFor="let c of nonRembourses()">
          <label class="check-wrap">
            <input
              type="checkbox"
              [checked]="clientEnPaiement()?._id === c._id"
              (change)="clientEnPaiement()?._id === c._id ? annulerPaiement(c) : ouvrirPaiement(c)"
            />
            <span class="check-box"></span>
          </label>
          <div class="row-body">
            <div class="row-top">
              <span class="nom">{{ c.nom }}</span>
              <span class="solde">{{ c.soldeDu | number:'1.0-0' }} FCFA</span>
            </div>
            <a *ngIf="c.telephone" class="btn-call" [href]="'tel:' + c.telephone">
              <mat-icon>call</mat-icon> {{ c.telephone }}
            </a>
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
            <button class="btn-cancel" (click)="annulerPaiement(c)">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Remboursés -->
      <div class="section" *ngIf="!chargement() && rembourses().length > 0">
        <button class="toggle-rembourses" (click)="voirRembourses.set(!voirRembourses())">
          <mat-icon>{{ voirRembourses() ? 'expand_less' : 'expand_more' }}</mat-icon>
          {{ rembourses().length }} client(s) soldé(s)
        </button>
        <div class="client-row done" *ngFor="let c of rembourses()" [class.hidden]="!voirRembourses()">
          <span class="check-box checked"><mat-icon>check</mat-icon></span>
          <div class="row-body">
            <div class="row-top">
              <span class="nom">{{ c.nom }}</span>
              <span class="solde ok">Remboursé</span>
            </div>
          </div>
        </div>
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

    .client-row {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 8px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .client-row.done { opacity: .7; }
    .client-row.hidden { display: none; }

    .check-wrap { position: relative; display: flex; align-items: center; cursor: pointer; margin-top: 2px; }
    .check-wrap input { position: absolute; opacity: 0; width: 22px; height: 22px; cursor: pointer; margin: 0; }
    .check-box {
      width: 22px; height: 22px; border-radius: 7px;
      border: 2px solid var(--navy-border);
      background: transparent;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .check-box.checked {
      background: var(--accent); border-color: var(--accent); color: #04241c;
    }
    .check-box.checked mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .row-body { flex: 1; min-width: 0; }
    .row-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .nom { color: var(--text-1); font-weight: 700; font-size: 14px; }
    .solde { color: var(--warning, #f39c12); font-weight: 700; font-size: 13px; white-space: nowrap; }
    .solde.ok { color: var(--accent); font-size: 12px; font-weight: 600; }

    .btn-call {
      display: inline-flex; align-items: center; gap: 4px;
      color: #2ecc71; font-size: 12px; margin-top: 6px; text-decoration: none;
    }
    .btn-call mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .pay-form { display: flex; gap: 8px; margin-top: 10px; width: 100%; }
    .pay-form input {
      flex: 1; background: var(--navy); border: 1px solid var(--navy-border);
      border-radius: 8px; color: var(--text-1); padding: 8px 10px; font-size: 13px;
    }
    .btn-confirm { background: var(--accent); color: #000; border: none; border-radius: 8px; padding: 0 14px; font-weight: 700; font-size: 12px; }
    .btn-confirm:disabled { opacity: .4; }
    .btn-cancel { background: transparent; color: var(--text-3); border: none; font-size: 12px; }

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
