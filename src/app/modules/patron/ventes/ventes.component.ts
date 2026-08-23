import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil, timeout, retry } from 'rxjs/operators';
import { RapportService, Vente } from '../../../core/services/rapport.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

type Periode = 'aujourd_hui' | 'semaine' | 'mois' | 'mois_dernier' | 'annee' | 'personnalise';

@Component({
  selector: 'app-ventes',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatSelectModule, MatFormFieldModule,
    MatInputModule, MatTooltipModule,
  ],
  template: `
    <div class="ventes-page">
      <div class="page-header">
        <h1>Ventes</h1>
      </div>

      <!-- Filtres -->
      <div class="filtres-card">
        <div class="periode-tabs">
          <button *ngFor="let p of periodes" class="tab-btn"
            [class.active]="periode === p.value"
            (click)="setPeriode(p.value)">
            {{ p.label }}
          </button>
        </div>
        <!-- Filtre boutique — visible seulement si le patron a plusieurs boutiques -->
        <div class="boutique-filter" *ngIf="boutiques().length > 0">
          <mat-icon class="boutique-icon">storefront</mat-icon>
          <select class="boutique-select" [(ngModel)]="boutiqueSelectId" (change)="charger()">
            <option value="">Toutes les boutiques</option>
            <option *ngFor="let b of boutiques()" [value]="b._id">{{ b.nom }}</option>
          </select>
        </div>
        <!-- Filtre agent — visible dès qu'il y a au moins un agent -->
        <div class="boutique-filter" *ngIf="agents().length > 0">
          <mat-icon class="boutique-icon">badge</mat-icon>
          <select class="boutique-select" [(ngModel)]="agentSelectId" (change)="charger()">
            <option value="">Tous les agents</option>
            <option *ngFor="let a of agents()" [value]="a._id">{{ a.nom }}</option>
          </select>
        </div>
        <div class="date-range" *ngIf="periode === 'personnalise'">
          <input type="date" [(ngModel)]="dateDebut" (change)="charger()" />
          <span>→</span>
          <input type="date" [(ngModel)]="dateFin" (change)="charger()" />
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-row" *ngIf="!isLoading() && ventes().length > 0">
        <div class="kpi">
          <div class="kpi-val">{{ totalCA() | number:'1.0-0' }} F</div>
          <div class="kpi-lbl">Chiffre d'affaires</div>
        </div>
        <div class="kpi">
          <div class="kpi-val">{{ ventes().length }}</div>
          <div class="kpi-lbl">Ventes</div>
        </div>
        <div class="kpi">
          <div class="kpi-val">{{ panierMoyen() | number:'1.0-0' }} F</div>
          <div class="kpi-lbl">Panier moyen</div>
        </div>
        <div class="kpi kpi-marge">
          <div class="kpi-val">{{ totalMarge() | number:'1.0-0' }} F</div>
          <div class="kpi-lbl">Marge brute</div>
        </div>
      </div>

      <!-- Export -->
      <div class="export-row" *ngIf="!isLoading() && ventes().length > 0">
        <span class="export-label">Exporter :</span>
        <button mat-stroked-button (click)="exportPDF()" [disabled]="isExporting">
          <mat-icon>picture_as_pdf</mat-icon> PDF
        </button>
        <button mat-stroked-button (click)="exportExcel()" [disabled]="isExporting">
          <mat-icon>table_chart</mat-icon> Excel
        </button>
      </div>

      <!-- Chargement -->
      <div class="loading-center" *ngIf="isLoading()">
        <mat-spinner diameter="36"></mat-spinner>
      </div>

      <!-- Vide -->
      <div class="empty-state" *ngIf="!isLoading() && ventes().length === 0">
        <mat-icon>receipt_long</mat-icon>
        <p>Aucune vente sur cette période</p>
      </div>

      <!-- Liste -->
      <div class="ventes-list" *ngIf="!isLoading() && ventes().length > 0">
        <div class="vente-card" [class.vente-annulee]="v.statut === 'annule'" *ngFor="let v of ventes()">
          <div class="vente-header">
            <div class="vente-ticket">{{ v.numeroTicket }}</div>
            <div class="vente-date">{{ v.createdAt | date:'dd/MM HH:mm' }}</div>
            <div class="vente-montant">{{ v.montantTotal | number:'1.0-0' }} F</div>
          </div>
          <div class="vente-meta">
            <span class="badge-annulee" *ngIf="v.statut === 'annule'">
              <mat-icon>block</mat-icon> Annulée
            </span>
            <span class="badge-paiement" *ngIf="v.statut !== 'annule'">
              {{ modeLabel(v.modePaiement) }}
              <button class="edit-mode-btn" *ngIf="dansFenetreCorrection(v)" (click)="ouvrirCorrectionMode(v)" title="Modifier le mode de paiement">
                <mat-icon>edit</mat-icon>
              </button>
            </span>
            <span class="vente-agent">{{ v.agentNom }}</span>
            <span class="vente-articles">{{ v.produits.length }} article(s)</span>
            <button class="btn-annuler-vente" *ngIf="v.statut !== 'annule' && dansFenetreCorrection(v)" (click)="ouvrirAnnulation(v)" title="Annuler cette vente">
              <mat-icon>delete_outline</mat-icon> Annuler la vente
            </button>
          </div>
          <p class="vente-annulation-info" *ngIf="v.statut === 'annule' && v.annulation">
            Annulée par {{ v.annulation.parNom }} le {{ v.annulation.date | date:'dd/MM HH:mm' }}
            <span *ngIf="v.annulation.motif"> — {{ v.annulation.motif }}</span>
          </p>
          <div class="vente-lignes">
            <div *ngFor="let p of v.produits; let i = index" class="ligne-produit-row">
              <span class="lp-nom">{{ p.nom }} ×{{ p.quantite }}</span>
              <span class="lp-prix">
                {{ p.prixUnitaire | number:'1.0-0' }} F
                <button class="edit-mode-btn" *ngIf="dansFenetreCorrection(v)" (click)="ouvrirCorrectionPrix(v, i)" title="Corriger ce prix">
                  <mat-icon>edit</mat-icon>
                </button>
              </span>
            </div>
          </div>

          <!-- Correction inline (mode de paiement ou prix d'une ligne) — fenêtre 24h -->
          <div class="correction-panel" *ngIf="correctionCible?.venteId === v._id">
            <ng-container *ngIf="correctionCible?.type === 'mode'">
              <p class="correction-hint">Modifiable seulement dans les 24h suivant la vente.</p>
              <div class="modes-grid">
                <button
                  *ngFor="let m of modesPaiement"
                  class="mode-choice"
                  [class.active]="nouveauMode === m.valeur"
                  (click)="nouveauMode = m.valeur"
                >{{ m.labelFr }}</button>
              </div>
            </ng-container>
            <ng-container *ngIf="correctionCible?.type === 'prix'">
              <p class="correction-hint">
                Prix erroné signalé par un agent ? Corrigez-le ici — recalcule automatiquement le total de la vente.
              </p>
              <div class="prix-edit-row">
                <input type="number" min="0" [(ngModel)]="nouveauPrix" placeholder="Nouveau prix (FCFA)" />
              </div>
            </ng-container>
            <div class="correction-actions">
              <button class="btn-cancel" (click)="annulerCorrection()">Annuler</button>
              <button
                class="btn-confirm"
                [disabled]="correctionSaving || (correctionCible?.type === 'mode' && nouveauMode === v.modePaiement) || (correctionCible?.type === 'prix' && !nouveauPrix)"
                (click)="confirmerCorrection(v)"
              >{{ correctionSaving ? 'Enregistrement...' : 'Confirmer' }}</button>
            </div>
            <p class="correction-error" *ngIf="correctionError">{{ correctionError }}</p>
          </div>

          <!-- Confirmation d'annulation de vente — fenêtre 24h, stock restauré auto -->
          <div class="annulation-panel" *ngIf="annulationCibleId === v._id">
            <p class="correction-hint">
              Le stock vendu sera automatiquement remis en stock{{ v.modePaiement === 'credit' ? ', et le solde dû du client sera réduit du montant de cette vente' : '' }}. Cette action est irréversible.
            </p>
            <input
              type="text"
              class="motif-input"
              [(ngModel)]="motifAnnulation"
              placeholder="Motif (ex: Signalé par le client)"
              maxlength="300"
            />
            <div class="correction-actions">
              <button class="btn-cancel" (click)="fermerAnnulation()">Retour</button>
              <button class="btn-confirm btn-danger" [disabled]="annulationSaving" (click)="confirmerAnnulation(v)">
                {{ annulationSaving ? 'Annulation...' : 'Confirmer l\\'annulation' }}
              </button>
            </div>
            <p class="correction-error" *ngIf="annulationError">{{ annulationError }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ventes-page { max-width: 800px; margin: 0 auto; width: 100%; }
    .page-header { margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: var(--text-1); }

    .filtres-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .periode-tabs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tab-btn {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--navy-border);
      background: transparent;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
    }
    .tab-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #04241c;
    }
    /* Filtre boutique */
    .boutique-filter {
      display: flex; align-items: center; gap: 6px;
      margin-top: 10px;
      padding: 6px 10px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 10px;
    }
    .boutique-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-3); flex-shrink: 0; }
    .boutique-select {
      background: transparent; border: none; color: var(--text-2);
      font-size: 13px; cursor: pointer; outline: none; flex: 1; min-width: 0;
    }
    .boutique-select option { background: var(--navy-light); color: var(--text-1); }
    .date-range {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
    }
    .date-range input {
      background: var(--navy);
      border: 1px solid var(--navy-border);
      border-radius: 8px;
      padding: 8px;
      color: var(--text-1);
      font-size: 13px;
      flex: 1;
    }
    .date-range span { color: var(--text-3); }

    /* Tablette : un peu plus d'air, boutons plus confortables au doigt */
    @media (min-width: 768px) {
      .filtres-card { padding: 16px 18px; }
      .periode-tabs { gap: 10px; }
      .tab-btn { padding: 9px 20px; font-size: 13.5px; }
      .date-range { margin-top: 14px; gap: 10px; max-width: 360px; }
      .date-range input { padding: 10px 12px; font-size: 14px; }
    }

    /* Desktop : page plus large, filtres alignés sur une ligne, boutons à taille normale (pas minuscules) */
    @media (min-width: 1024px) {
      .ventes-page { max-width: 1200px; margin: 0 auto; }
      h1 { font-size: 26px; }
      .filtres-card {
        padding: 18px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: nowrap;
      }
      .periode-tabs { gap: 8px; flex: 1; flex-wrap: nowrap; }
      .tab-btn {
        padding: 10px 22px;
        font-size: 14px;
        border-radius: 22px;
        white-space: nowrap;
      }
      .date-range { margin-top: 0; flex-shrink: 0; }
      .boutique-filter { margin-top: 0; flex-shrink: 0; }
    }
    /* Deux sélecteurs + onglets peuvent dépasser en largeur moyenne : on autorise
       le retour à la ligne plutôt qu'un débordement horizontal caché */
    @media (min-width: 1024px) and (max-width: 1300px) {
      .filtres-card { flex-wrap: wrap; }
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    @media (max-width: 480px) {
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
    }
    .kpi {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 12px;
      padding: 14px;
      text-align: center;
    }
    .kpi-val { font-size: 16px; font-weight: 700; color: var(--accent); }
    .kpi-lbl { font-size: 11px; color: var(--text-3); margin-top: 2px; }

    .export-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .export-label { font-size: 13px; color: var(--text-2); }

    .loading-center { display: flex; justify-content: center; padding: 40px 0; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 60px 0; color: var(--text-3);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }

    .ventes-list { display: flex; flex-direction: column; gap: 8px; }
    .vente-card {
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .vente-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .vente-ticket {
      font-size: 12px;
      font-family: monospace;
      color: var(--accent);
      font-weight: 700;
      flex: 1;
    }
    .vente-date { font-size: 12px; color: var(--text-3); }
    .vente-montant { font-size: 15px; font-weight: 700; color: var(--text-1); }
    .vente-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .badge-paiement {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 20px;
      background: var(--accent-lite);
      color: var(--accent);
      border: 1px solid rgba(0,184,148,.2);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .vente-agent { font-size: 12px; color: var(--text-2); }
    .vente-articles { font-size: 11px; color: var(--text-3); margin-left: auto; }
    .vente-lignes {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ligne-produit-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-3);
      background: rgba(255,255,255,.04);
      border-radius: 6px;
      padding: 3px 7px;
    }
    .lp-prix { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .edit-mode-btn {
      display: inline-flex; align-items: center; justify-content: center;
      background: none; border: none; color: inherit; cursor: pointer; padding: 0;
      opacity: .75;
    }
    .edit-mode-btn mat-icon { font-size: 12px; width: 12px; height: 12px; }

    .correction-panel {
      background: rgba(255,255,255,.03); border: 1px solid var(--navy-border);
      border-radius: 10px; padding: 10px; margin-top: 8px;
    }
    .correction-hint { color: var(--text-3); font-size: 11px; margin: 0 0 8px; }
    .modes-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .mode-choice {
      background: var(--navy); border: 1px solid var(--navy-border); color: var(--text-2);
      font-size: 12px; font-weight: 600; padding: 7px 12px; border-radius: 8px; cursor: pointer;
    }
    .mode-choice.active { background: var(--accent-lite); border-color: var(--accent); color: var(--accent); }
    .prix-edit-row { margin-bottom: 10px; }
    .prix-edit-row input {
      width: 100%; background: var(--navy); border: 1px solid var(--navy-border);
      border-radius: 8px; color: var(--text-1); padding: 9px 12px; font-size: 14px; font-weight: 600;
    }
    .correction-actions { display: flex; gap: 8px; }
    .btn-cancel {
      background: transparent; color: var(--text-3); border: 1px solid var(--navy-border);
      border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .btn-confirm {
      flex: 1; background: var(--accent); color: #04241c; border: none;
      border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
    }
    .btn-confirm:disabled { opacity: .4; }
    .correction-error { color: #e74c3c; font-size: 11px; margin: 8px 0 0; }
    .vente-annulee { opacity: .55; }
    .badge-annulee {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(231,76,60,.12); color: #e74c3c;
      padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;
    }
    .badge-annulee mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .vente-annulation-info { color: var(--text-3); font-size: 11px; margin: 4px 0 0; }
    .btn-annuler-vente {
      display: inline-flex; align-items: center; gap: 4px;
      background: transparent; border: none; color: var(--text-3);
      font-size: 11px; cursor: pointer; padding: 2px 4px; margin-left: auto;
    }
    .btn-annuler-vente:hover { color: #e74c3c; }
    .btn-annuler-vente mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .annulation-panel {
      margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border);
    }
    .motif-input {
      width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--bg-2); color: var(--text-1);
      font-size: 13px; margin: 6px 0;
    }
    .btn-danger { background: #e74c3c !important; }
  `]
})
export class VentesComponent implements OnInit, OnDestroy {
  private rapport = inject(RapportService);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private api = inject(ApiService);
  private destroy$ = new Subject<void>();

  ventes = signal<Vente[]>([]);
  isLoading = signal(false);
  isExporting = false;

  periode: Periode = 'aujourd_hui';
  dateDebut = '';
  dateFin = '';
  boutiqueSelectId = '';   // '' = toutes les boutiques
  boutiques = signal<any[]>([]);
  agentSelectId = '';      // '' = tous les agents
  agents = signal<any[]>([]);

  periodes = [
    { value: 'aujourd_hui' as Periode, label: "Auj." },
    { value: 'semaine' as Periode, label: "Semaine" },
    { value: 'mois' as Periode, label: "Ce mois" },
    { value: 'mois_dernier' as Periode, label: "Mois préc." },
    { value: 'annee' as Periode, label: "Année" },
    { value: 'personnalise' as Periode, label: "Dates..." },
  ];

  // Une vente annulée doit sortir des totaux affichés (CA, marge, panier
  // moyen) exactement comme elle sort déjà de /ventes/stats côté backend —
  // elle reste visible dans la liste (barrée, badge "Annulée") mais ne doit
  // plus compter comme un vrai chiffre d'affaires.
  private ventesActives = () => this.ventes().filter((v) => v.statut !== 'annule');
  totalCA = () => this.ventesActives().reduce((s, v) => s + v.montantTotal, 0);
  totalMarge = () => this.ventesActives().reduce((s, v) => s + (v.margeTotale || 0), 0);
  panierMoyen = () => this.ventesActives().length ? Math.round(this.totalCA() / this.ventesActives().length) : 0;

  // ─── Correction a posteriori (mode de paiement / prix) ─────────────
  private readonly FENETRE_CORRECTION_MS = 24 * 60 * 60 * 1000;
  modesPaiement = [
    { valeur: 'especes', labelFr: 'Espèces' },
    { valeur: 'wave', labelFr: 'Wave' },
    { valeur: 'orange_money', labelFr: 'Orange Money' },
    { valeur: 'free_money', labelFr: 'Free Money' },
    { valeur: 'credit', labelFr: 'Crédit' },
  ];
  correctionCible: { venteId: string; type: 'mode' | 'prix'; ligneIndex?: number } | null = null;
  nouveauMode = '';
  nouveauPrix: number | null = null;
  correctionSaving = false;
  correctionError = '';

  modeLabel(mode: string): string {
    return this.modesPaiement.find((m) => m.valeur === mode)?.labelFr || mode;
  }

  dansFenetreCorrection(v: Vente): boolean {
    return Date.now() - new Date(v.createdAt).getTime() < this.FENETRE_CORRECTION_MS;
  }

  ouvrirCorrectionMode(v: Vente): void {
    this.correctionCible = { venteId: v._id, type: 'mode' };
    this.nouveauMode = v.modePaiement;
    this.correctionError = '';
  }

  ouvrirCorrectionPrix(v: Vente, ligneIndex: number): void {
    this.correctionCible = { venteId: v._id, type: 'prix', ligneIndex };
    this.nouveauPrix = v.produits[ligneIndex].prixUnitaire;
    this.correctionError = '';
  }

  annulerCorrection(): void {
    this.correctionCible = null;
    this.correctionError = '';
  }

  confirmerCorrection(v: Vente): void {
    if (!this.correctionCible) return;
    const body: any = {};
    if (this.correctionCible.type === 'mode') {
      if (this.nouveauMode === v.modePaiement) return;
      body.modePaiement = this.nouveauMode;
    } else {
      if (!this.nouveauPrix || this.nouveauPrix < 0) return;
      body.ligneIndex = this.correctionCible.ligneIndex;
      body.prixUnitaire = this.nouveauPrix;
    }
    this.correctionSaving = true;
    this.correctionError = '';
    this.api.patch(`ventes/${v._id}/corriger`, body).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.correctionSaving = false;
        if (res?.success && res.data) {
          // Remplace la vente locale par la version corrigée renvoyée par le
          // serveur (montantTotal/margeTotale déjà recalculés côté backend)
          // — jamais recalculer soi-même côté client, source de vérité unique.
          this.ventes.update((liste) => liste.map((x) => x._id === v._id ? res.data : x));
          this.correctionCible = null;
          this.snack.open('✓ Vente corrigée', '✕', { duration: 2500 });
        } else {
          this.correctionError = res?.message || 'Erreur';
        }
      },
      error: (err) => {
        this.correctionSaving = false;
        this.correctionError = err?.error?.message || 'Erreur réseau';
      },
    });
  }

  // ─── Annulation de vente ────────────────────────────────────────────
  annulationCibleId: string | null = null;
  motifAnnulation = '';
  annulationSaving = false;
  annulationError = '';

  ouvrirAnnulation(v: Vente): void {
    this.correctionCible = null; // ferme la correction si ouverte, un seul panneau à la fois
    this.annulationCibleId = v._id;
    this.motifAnnulation = '';
    this.annulationError = '';
  }

  fermerAnnulation(): void {
    this.annulationCibleId = null;
    this.annulationError = '';
  }

  confirmerAnnulation(v: Vente): void {
    this.annulationSaving = true;
    this.annulationError = '';
    this.api.patch(`ventes/${v._id}/annuler`, { motif: this.motifAnnulation }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.annulationSaving = false;
        if (res?.success && res.data) {
          this.ventes.update((liste) => liste.map((x) => x._id === v._id ? res.data : x));
          this.annulationCibleId = null;
          this.snack.open('✓ Vente annulée, stock restauré', '✕', { duration: 3000 });
        } else {
          this.annulationError = res?.message || 'Erreur';
        }
      },
      error: (err) => {
        this.annulationSaving = false;
        this.annulationError = err?.error?.message || 'Erreur réseau';
      },
    });
  }

  ngOnInit() {
    this.charger();
    // Charger les boutiques pour le sélecteur (silencieusement, si aucune = sélecteur caché)
    this.api.get('boutiques').pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r: any) => { this.boutiques.set(r.data || []); }, error: () => {} });
    // Charger les agents pour le sélecteur "par agent" (silencieusement)
    this.rapport.getAgentsPourFiltre().pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r: any) => { this.agents.set(r.data || []); }, error: () => {} });
  }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  setPeriode(p: Periode) {
    this.periode = p;
    if (p !== 'personnalise') this.charger();
  }

  charger() {
    const { debut, fin } = this.getRange();
    if (!debut || !fin) return;
    this.isLoading.set(true);
    this.rapport.getVentes(debut, fin, this.boutiqueSelectId || undefined, this.agentSelectId || undefined).pipe(
      timeout(15000),
      retry({ count: 3, delay: 4000 }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (res: any) => {
        this.ventes.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.snack.open('Erreur chargement ventes', 'OK', { duration: 3000 });
        this.isLoading.set(false);
      }
    });
  }

  getRange(): { debut: string; fin: string } {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString();
    switch (this.periode) {
      case 'aujourd_hui': {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { debut: fmt(d), fin: fmt(new Date(d.getTime() + 86400000 - 1)) };
      }
      case 'semaine': {
        // Lundi de la semaine courante (convention EU/Afrique — semaine commence lundi)
        const day = now.getDay(); // 0=dim, 1=lun ... 6=sam
        const diffLundi = day === 0 ? -6 : 1 - day; // si dimanche → recule 6 jours
        const d = new Date(now);
        d.setDate(now.getDate() + diffLundi);
        d.setHours(0, 0, 0, 0);
        return { debut: fmt(d), fin: fmt(now) };
      }
      case 'mois': {
        return { debut: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), fin: fmt(now) };
      }
      case 'mois_dernier': {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const f = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { debut: fmt(d), fin: fmt(f) };
      }
      case 'annee': {
        return { debut: fmt(new Date(now.getFullYear(), 0, 1)), fin: fmt(now) };
      }
      case 'personnalise': {
        return { debut: this.dateDebut ? new Date(this.dateDebut).toISOString() : '', fin: this.dateFin ? new Date(this.dateFin + 'T23:59:59').toISOString() : '' };
      }
    }
  }

  getPeriodeLabel(): string {
    const p = this.periodes.find(x => x.value === this.periode);
    return p?.label ?? '';
  }

  async exportPDF() {
    this.isExporting = true;
    const boutique = this.auth.getUser()?.boutique || 'SmartStock';
    try {
      await this.rapport.exportPDF(this.ventes(), this.getPeriodeLabel(), boutique);
    } finally { this.isExporting = false; }
  }

  async exportExcel() {
    this.isExporting = true;
    try {
      await this.rapport.exportExcel(this.ventes(), this.getPeriodeLabel());
    } finally { this.isExporting = false; }
  }
}
