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
        <div class="vente-card" *ngFor="let v of ventes()">
          <div class="vente-header">
            <div class="vente-ticket">{{ v.numeroTicket }}</div>
            <div class="vente-date">{{ v.createdAt | date:'dd/MM HH:mm' }}</div>
            <div class="vente-montant">{{ v.montantTotal | number:'1.0-0' }} F</div>
          </div>
          <div class="vente-meta">
            <span class="badge-paiement">{{ v.modePaiement }}</span>
            <span class="vente-agent">{{ v.agentNom }}</span>
            <span class="vente-articles">{{ v.produits.length }} article(s)</span>
          </div>
          <div class="vente-lignes">
            <span *ngFor="let p of v.produits" class="ligne-produit">
              {{ p.nom }} ×{{ p.quantite }}
            </span>
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
    .boutique-select option { background: #162236; color: var(--text-1); }
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
    }
    .vente-agent { font-size: 12px; color: var(--text-2); }
    .vente-articles { font-size: 11px; color: var(--text-3); margin-left: auto; }
    .vente-lignes {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .ligne-produit {
      font-size: 11px;
      color: var(--text-3);
      background: rgba(255,255,255,.04);
      border-radius: 6px;
      padding: 2px 7px;
    }
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

  periodes = [
    { value: 'aujourd_hui' as Periode, label: "Auj." },
    { value: 'semaine' as Periode, label: "Semaine" },
    { value: 'mois' as Periode, label: "Ce mois" },
    { value: 'mois_dernier' as Periode, label: "Mois préc." },
    { value: 'annee' as Periode, label: "Année" },
    { value: 'personnalise' as Periode, label: "Dates..." },
  ];

  totalCA = () => this.ventes().reduce((s, v) => s + v.montantTotal, 0);
  totalMarge = () => this.ventes().reduce((s, v) => s + (v.margeTotale || 0), 0);
  panierMoyen = () => this.ventes().length ? Math.round(this.totalCA() / this.ventes().length) : 0;

  ngOnInit() {
    this.charger();
    // Charger les boutiques pour le sélecteur (silencieusement, si aucune = sélecteur caché)
    this.api.get('boutiques').pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r: any) => { this.boutiques.set(r.data || []); }, error: () => {} });
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
    this.rapport.getVentes(debut, fin, this.boutiqueSelectId || undefined).pipe(
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
