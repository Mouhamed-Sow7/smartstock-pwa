import { Component, OnDestroy, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';

interface VenteHisto {
  _id: string;
  numeroTicket: string;
  createdAt: string;
  montantTotal: number;
  modePaiement: string;
  agentId?: string;
  statut?: string;
  annulation?: { date: string; parRole: string; parNom: string; motif: string };
  produits: { nom: string; quantite: number }[];
}

const MODES_PAIEMENT: { valeur: string; labelFr: string; labelAr: string }[] = [
  { valeur: 'especes', labelFr: 'Espèces', labelAr: 'نقدًا' },
  { valeur: 'wave', labelFr: 'Wave', labelAr: 'Wave' },
  { valeur: 'orange_money', labelFr: 'Orange Money', labelAr: 'Orange Money' },
  { valeur: 'free_money', labelFr: 'Free Money', labelAr: 'Free Money' },
  { valeur: 'credit', labelFr: 'Crédit', labelAr: 'دين' },
];
const FENETRE_CORRECTION_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-agent-historique',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="historique-page">
      <div class="histo-header">
        <h1>{{ i18n.t('hist.titre') }}</h1>
        <button class="reload-btn" (click)="charger()" [disabled]="_isLoading" [title]="i18n.lang() === 'ar' ? 'تحديث' : 'Actualiser'">
          <mat-icon [class.spin]="_isLoading">refresh</mat-icon>
        </button>
      </div>
      <div class="recherche-produit">
        <mat-icon>search</mat-icon>
        <input
          type="text"
          [(ngModel)]="rechercheProduit"
          (keyup.enter)="charger()"
          [placeholder]="i18n.lang() === 'ar' ? 'ابحث عن منتج في المبيعات...' : 'Chercher un produit dans les ventes...'"
        />
        <button class="clear-recherche" *ngIf="rechercheProduit" (click)="rechercheProduit=''; charger()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="sub" *ngIf="!_isLoading && !_error">{{ _ventes.length }} {{ i18n.lang() === 'ar' ? 'عملية بيع' : 'vente(s)' }}</div>

      <div class="loader" *ngIf="_isLoading">
        <mat-icon class="spin">autorenew</mat-icon> {{ i18n.lang() === 'ar' ? 'جارٍ التحميل...' : 'Chargement...' }}
      </div>

      <div class="error-state" *ngIf="_error && !_isLoading">
        <mat-icon>wifi_off</mat-icon>
        <p>{{ i18n.lang() === 'ar' ? 'تعذّر تحميل السجل' : "Impossible de charger l'historique" }}</p>
        <button class="retry-btn" (click)="charger()">{{ i18n.lang() === 'ar' ? 'إعادة المحاولة' : 'Réessayer' }}</button>
      </div>

      <div class="empty" *ngIf="!_isLoading && !_error && _ventes.length === 0">
        <mat-icon>receipt_long</mat-icon>
        <p>{{ i18n.t('dash.aucuneVente') }}</p>
      </div>

      <div class="vente-card" [class.vente-annulee]="v.statut === 'annule'" *ngFor="let v of _ventes">
        <div class="vente-top">
          <span class="ticket">{{ v.numeroTicket }}</span>
          <span class="montant">{{ v.montantTotal | number: '1.0-0' }} F</span>
        </div>
        <div class="vente-mid">
          <span class="badge badge-annulee" *ngIf="v.statut === 'annule'">
            <mat-icon>block</mat-icon> {{ i18n.lang() === 'ar' ? 'ملغاة' : 'Annulée' }}
          </span>
          <span class="badge" *ngIf="v.statut !== 'annule'">
            {{ modeLabel(v.modePaiement) }}
            <button
              class="edit-mode-btn"
              *ngIf="dansFenetreCorrection(v)"
              (click)="ouvrirCorrection(v)"
              [title]="i18n.lang() === 'ar' ? 'تعديل طريقة الدفع' : 'Modifier le mode de paiement'"
            >
              <mat-icon>edit</mat-icon>
            </button>
          </span>
          <span class="date">{{ v.createdAt | date: 'dd/MM HH:mm' }}</span>
        </div>
        <button
          class="btn-annuler-vente"
          *ngIf="v.statut !== 'annule' && dansFenetreCorrection(v)"
          (click)="ouvrirAnnulation(v)"
        >
          <mat-icon>delete_outline</mat-icon>
          {{ i18n.lang() === 'ar' ? 'إلغاء عملية البيع هذه' : 'Annuler cette vente' }}
        </button>

        <!-- Correction inline du mode de paiement — fenêtre 24h -->
        <div class="correction-panel" *ngIf="venteEnCorrection?._id === v._id">
          <p class="correction-hint">
            {{ i18n.lang() === 'ar'
              ? 'يمكن تعديل طريقة الدفع خلال 24 ساعة من البيع فقط.'
              : 'Modifiable seulement dans les 24h suivant la vente.' }}
          </p>
          <div class="modes-grid">
            <button
              *ngFor="let m of modesPaiement"
              class="mode-choice"
              [class.active]="nouveauMode === m.valeur"
              (click)="nouveauMode = m.valeur"
            >
              {{ i18n.lang() === 'ar' ? m.labelAr : m.labelFr }}
            </button>
          </div>
          <div class="correction-actions">
            <button class="btn-cancel" (click)="annulerCorrection()">
              {{ i18n.lang() === 'ar' ? 'إلغاء' : 'Annuler' }}
            </button>
            <button
              class="btn-confirm"
              [disabled]="correctionSaving || nouveauMode === v.modePaiement"
              (click)="confirmerCorrection(v)"
            >
              {{ correctionSaving
                ? (i18n.lang() === 'ar' ? 'جارٍ الحفظ...' : 'Enregistrement...')
                : (i18n.lang() === 'ar' ? 'Confirmer' : 'Confirmer') }}
            </button>
          </div>
          <p class="correction-error" *ngIf="correctionError">{{ correctionError }}</p>
        </div>

        <!-- Confirmation d'annulation — fenêtre 24h, stock restauré auto côté serveur -->
        <div class="correction-panel" *ngIf="venteEnAnnulation?._id === v._id">
          <p class="correction-hint">
            {{ i18n.lang() === 'ar'
              ? 'سيُعاد المخزون تلقائيًا. لا يمكن التراجع عن هذا الإجراء.'
              : 'Le stock sera automatiquement remis en stock. Cette action est irréversible.' }}
          </p>
          <input
            type="text"
            class="motif-input"
            [(ngModel)]="motifAnnulation"
            [placeholder]="i18n.lang() === 'ar' ? 'السبب (مثال: بلاغ من الزبون)' : 'Motif (ex: Signalé par le client)'"
            maxlength="300"
          />
          <div class="correction-actions">
            <button class="btn-cancel" (click)="fermerAnnulation()">
              {{ i18n.lang() === 'ar' ? 'رجوع' : 'Retour' }}
            </button>
            <button
              class="btn-confirm btn-danger"
              [disabled]="annulationSaving"
              (click)="confirmerAnnulation(v)"
            >
              {{ annulationSaving
                ? (i18n.lang() === 'ar' ? 'جارٍ الإلغاء...' : 'Annulation...')
                : (i18n.lang() === 'ar' ? 'تأكيد الإلغاء' : "Confirmer l'annulation") }}
            </button>
          </div>
          <p class="correction-error" *ngIf="annulationError">{{ annulationError }}</p>
        </div>

        <p class="vente-annulation-info" *ngIf="v.statut === 'annule' && v.annulation">
          {{ i18n.lang() === 'ar' ? 'أُلغيت بواسطة' : 'Annulée par' }} {{ v.annulation.parNom }}
          — {{ v.annulation.date | date: 'dd/MM HH:mm' }}
          <span *ngIf="v.annulation.motif"> · {{ v.annulation.motif }}</span>
        </p>

        <div class="vente-items">
          <span class="item" *ngFor="let p of v.produits">{{ p.nom }} ×{{ p.quantite }}</span>
        </div>
      </div>

      <button class="load-more-btn" *ngIf="_hasMore && !_isLoading" (click)="chargerPlus()" [disabled]="_isLoadingMore">
        <mat-icon [class.spin]="_isLoadingMore">{{ _isLoadingMore ? 'autorenew' : 'expand_more' }}</mat-icon>
        {{ _isLoadingMore
          ? (i18n.lang() === 'ar' ? 'جارٍ التحميل...' : 'Chargement...')
          : (i18n.lang() === 'ar' ? 'تحميل المزيد' : 'Charger plus') }}
      </button>
    </div>
  `,
  styles: [`
    .historique-page { max-width: 600px; margin: 0 auto; }
    .histo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .recherche-produit { display: flex; align-items: center; gap: 8px; background: var(--surface-2, #f0f0f4); border-radius: 10px; padding: 8px 12px; margin: 8px 0 12px; }
    .recherche-produit mat-icon { color: var(--text-2); font-size: 20px; width: 20px; height: 20px; }
    .recherche-produit input { flex: 1; border: none; background: transparent; outline: none; font-size: 14px; color: var(--text-1); }
    .clear-recherche { background: none; border: none; padding: 2px; display: flex; color: var(--text-2); }
    h1 { font-size: 22px; font-weight: 700; color: var(--text-1); margin: 0; }
    .reload-btn {
      width: 36px; height: 36px; border-radius: 10px; border: none;
      background: rgba(255,255,255,.06); color: var(--text-2);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .reload-btn:hover { background: rgba(255,255,255,.12); color: var(--accent); }
    .reload-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .sub { color: var(--text-3); font-size: 12px; margin-bottom: 16px; }

    .loader { display: flex; align-items: center; gap: 8px; color: var(--text-3); padding: 24px 0; justify-content: center; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-state { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-3); padding: 40px 0; text-align: center; }
    .error-state mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--danger); opacity: .7; }
    .retry-btn {
      padding: 8px 20px; border-radius: 10px; border: 1px solid var(--accent);
      background: var(--accent-lite); color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer;
    }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-3); padding: 48px 0; }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .5; }

    .vente-card {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 14px; padding: 14px; margin-bottom: 10px; backdrop-filter: blur(12px);
    }
    .vente-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .ticket { color: var(--accent); font-size: 13px; font-weight: 700; font-family: monospace; }
    .montant { color: var(--text-1); font-size: 16px; font-weight: 700; }
    .vente-mid { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .badge {
      background: var(--accent-lite); color: var(--accent);
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 10px;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .edit-mode-btn {
      display: inline-flex; align-items: center; justify-content: center;
      background: none; border: none; color: inherit; cursor: pointer; padding: 0;
      opacity: .8;
    }
    .edit-mode-btn mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .date { color: var(--text-3); font-size: 11px; }
    .vente-items { display: flex; flex-wrap: wrap; gap: 6px; }
    .item { background: rgba(255,255,255,.05); color: var(--text-2); font-size: 11px; padding: 3px 8px; border-radius: 8px; }

    .correction-panel {
      background: rgba(255,255,255,.03); border: 1px solid var(--navy-border);
      border-radius: 10px; padding: 10px; margin: -2px 0 10px;
    }
    .correction-hint { color: var(--text-3); font-size: 11px; margin: 0 0 8px; }
    .modes-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .mode-choice {
      background: var(--navy); border: 1px solid var(--navy-border); color: var(--text-2);
      font-size: 12px; font-weight: 600; padding: 7px 12px; border-radius: 8px; cursor: pointer;
    }
    .mode-choice.active { background: var(--accent-lite); border-color: var(--accent); color: var(--accent); }
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
    .badge-annulee { background: rgba(231,76,60,.15) !important; color: #e74c3c !important; }
    .btn-annuler-vente {
      display: inline-flex; align-items: center; gap: 4px;
      background: transparent; border: none; color: var(--text-3);
      font-size: 11px; cursor: pointer; padding: 4px 0; margin-bottom: 8px;
    }
    .btn-annuler-vente mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .motif-input {
      width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px;
      border: 1px solid var(--navy-border); background: var(--navy); color: var(--text-1);
      font-size: 13px; margin: 0 0 10px;
    }
    .btn-danger { background: #e74c3c !important; color: #fff !important; }
    .vente-annulation-info { color: var(--text-3); font-size: 11px; margin: 0 0 8px; }

    .load-more-btn {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      width: 100%; margin-top: 4px; padding: 12px; border-radius: 12px;
      border: 1px solid var(--navy-border); background: var(--navy-card);
      color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .load-more-btn:disabled { opacity: .6; cursor: default; }
    .load-more-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class AgentHistoriqueComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  _ventes: VenteHisto[] = [];
  _isLoading = false;
  _isLoadingMore = false;
  _error = false;
  _page = 1;
  _hasMore = false;
  rechercheProduit = '';
  private readonly LIMIT = 30;

  modesPaiement = MODES_PAIEMENT;
  venteEnCorrection: VenteHisto | null = null;
  nouveauMode = '';
  correctionSaving = false;
  correctionError = '';

  modeLabel(mode: string): string {
    const m = MODES_PAIEMENT.find((x) => x.valeur === mode);
    if (!m) return mode;
    return this.i18n.lang() === 'ar' ? m.labelAr : m.labelFr;
  }

  dansFenetreCorrection(v: VenteHisto): boolean {
    return Date.now() - new Date(v.createdAt).getTime() < FENETRE_CORRECTION_MS;
  }

  ouvrirCorrection(v: VenteHisto): void {
    this.venteEnCorrection = v;
    this.nouveauMode = v.modePaiement;
    this.correctionError = '';
  }

  annulerCorrection(): void {
    this.venteEnCorrection = null;
    this.correctionError = '';
  }

  confirmerCorrection(v: VenteHisto): void {
    if (this.nouveauMode === v.modePaiement) return;
    this.correctionSaving = true;
    this.correctionError = '';
    this.api.patch(`ventes/${v._id}/corriger`, { modePaiement: this.nouveauMode }).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          this.correctionSaving = false;
          if (res?.success) {
            v.modePaiement = this.nouveauMode;
            this.venteEnCorrection = null;
          } else {
            this.correctionError = res?.message || 'Erreur';
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.correctionSaving = false;
          this.correctionError = err?.error?.message || 'Erreur réseau';
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Annulation de vente ────────────────────────────────────────────
  venteEnAnnulation: VenteHisto | null = null;
  motifAnnulation = '';
  annulationSaving = false;
  annulationError = '';

  ouvrirAnnulation(v: VenteHisto): void {
    this.venteEnCorrection = null; // un seul panneau ouvert à la fois
    this.venteEnAnnulation = v;
    this.motifAnnulation = '';
    this.annulationError = '';
  }

  fermerAnnulation(): void {
    this.venteEnAnnulation = null;
    this.annulationError = '';
  }

  confirmerAnnulation(v: VenteHisto): void {
    this.annulationSaving = true;
    this.annulationError = '';
    this.api.patch(`ventes/${v._id}/annuler`, { motif: this.motifAnnulation }).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          this.annulationSaving = false;
          if (res?.success && res.data) {
            v.statut = res.data.statut;
            v.annulation = res.data.annulation;
            this.venteEnAnnulation = null;
          } else {
            this.annulationError = res?.message || 'Erreur';
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.annulationSaving = false;
          this.annulationError = err?.error?.message || 'Erreur réseau';
          this.cdr.detectChanges();
        });
      },
    });
  }

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void { this.charger(); }

  /** Historique d'un agent = seule liste vraiment non bornée dans le temps
   * de tout le parcours agent (contrairement au rapport patron, toujours
   * filtré par plage de dates) : un agent en poste depuis des mois/années
   * accumule des ventes sans limite. Chargement paginé "charger plus" au
   * lieu de tout rapatrier d'un coup — voir audit 2026-08-20 (STATE.md). */
  charger(): void {
    this._page = 1;
    this._chargerPage(1, false);
  }

  chargerPlus(): void {
    if (this._isLoadingMore || !this._hasMore) return;
    this._chargerPage(this._page + 1, true);
  }

  private _chargerPage(page: number, append: boolean): void {
    const user = this.auth.getUser();
    const userId = user?._id || user?.id;
    const base = userId ? `ventes?agentId=${userId}` : 'ventes?';
    const filtreProduit = this.rechercheProduit.trim()
      ? `&produit=${encodeURIComponent(this.rechercheProduit.trim())}`
      : '';
    const path = `${base}&page=${page}&limit=${this.LIMIT}${filtreProduit}`;

    if (append) { this._isLoadingMore = true; } else { this._isLoading = true; this._error = false; }
    this.cdr.detectChanges();

    this.api.get(path).pipe(
      catchError(err => {
        console.error('Historique agent:', err?.status, err?.message);
        return of(null);
      }),
      takeUntil(this.destroy$),
    ).subscribe((res: any) => {
      // NgZone.run() garantit que Angular détecte le changement
      // même si l'observable se résout hors zone (cas des retries longs)
      this.zone.run(() => {
        if (res?.success) {
          this._ventes = append ? [...this._ventes, ...(res.data ?? [])] : (res.data ?? []);
          this._hasMore = !!res.pagination?.hasMore;
          this._page = page;
          this._error = false;
        } else if (!append) {
          this._error = true;
        }
        this._isLoading = false;
        this._isLoadingMore = false;
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
