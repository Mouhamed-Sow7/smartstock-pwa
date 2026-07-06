import { Component, OnInit, OnDestroy, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ProduitDialogComponent } from './produit-dialog.component';
import { ProduitService } from './produit.service';

// Couleur par catégorie
const CAT_COLORS: Record<string, string> = {
  'Boissons':    '#0984e3',
  'Epicerie':    '#00b894',
  'Laitiers':    '#6c5ce7',
  'Hygiene':     '#fd79a8',
  'Entretien':   '#fdcb6e',
  'Snacks':      '#e17055',
  'Frais':       '#55efc4',
  'Telephonie':  '#a29bfe',
  'Feculents':   '#fab1a0',
};
function catColor(cat: string): string {
  return CAT_COLORS[cat] || '#636e72';
}
function catInitial(cat: string): string {
  return (cat || '?').charAt(0).toUpperCase();
}

@Component({
  selector: 'app-produits',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatDialogModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
    MatMenuModule, MatDividerModule,
  ],
  template: `
    <div class="produits-page">

      <!-- Header -->
      <div class="page-header">
        <h1>Produits
          <span class="produit-count" *ngIf="produits().length > 0">{{ produits().length }}</span>
        </h1>
        <div class="header-actions">
          <button class="btn-secondary" routerLink="/patron/produits/scanner">
            <mat-icon>qr_code_scanner</mat-icon> Scanner
          </button>
          <button class="btn-primary" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Ajouter
          </button>
        </div>
      </div>

      <!-- Recherche -->
      <div class="search-bar" *ngIf="produits().length > 0">
        <mat-icon>search</mat-icon>
        <input type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Rechercher un produit..." />
        <button class="clear-search" *ngIf="searchQuery()" (click)="searchQuery.set('')">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Loading -->
      <div class="loading-center" *ngIf="isLoading()">
        <mat-spinner diameter="36"></mat-spinner>
      </div>

      <!-- Empty -->
      <div class="empty-state" *ngIf="isEmpty()">
        <mat-icon>inventory_2</mat-icon>
        <p>Aucun produit. Ajoutez votre premier produit.</p>
      </div>

      <!-- Shelf rows groupées par catégorie -->
      <div class="shelf-container" *ngIf="!isLoading() && produits().length > 0">
        <ng-container *ngFor="let group of groupedProduits(); trackBy: trackByCategorie">

          <!-- Header catégorie -->
          <div class="cat-header">
            <span class="cat-dot" [style.background]="group.color"></span>
            <span class="cat-name">{{ group.categorie }}</span>
            <span class="cat-count">{{ group.items.length }}</span>
          </div>

          <!-- Rangées + panel stock inline DIRECTEMENT sous chaque produit -->
          <ng-container *ngFor="let p of group.items; trackBy: trackByProduit">
            <div class="shelf-row"
              [class.rupture]="p.stock === 0"
              [class.alerte]="p.stock > 0 && p.stock <= (p.seuilAlerte || 5)">

              <!-- Avatar catégorie -->
              <div class="row-avatar" [style.background]="group.color + '22'" [style.border-color]="group.color + '55'">
                <span [style.color]="group.color">{{ group.initial }}</span>
              </div>

              <!-- Infos principales -->
              <div class="row-body">
                <div class="row-top">
                  <span class="row-nom">{{ p.nom }}</span>
                  <!-- Badge stock -->
                  <span class="stock-badge rupture-badge" *ngIf="p.stock === 0">Rupture</span>
                  <span class="stock-badge alerte-badge" *ngIf="p.stock > 0 && p.stock <= (p.seuilAlerte || 5)">
                    <mat-icon>warning</mat-icon> {{ p.stock }}
                  </span>
                  <span class="stock-badge ok-badge" *ngIf="p.stock > (p.seuilAlerte || 5)">{{ p.stock }}</span>
                </div>
                <div class="row-bottom">
                  <span class="row-prix">{{ p.prix | number:'1.0-0' }} FCFA</span>
                  <span class="row-sep">·</span>
                  <span class="row-code" *ngIf="p.codeBarres">{{ p.codeBarres }}</span>
                  <span class="row-marge" *ngIf="p.prixAchat">
                    Marge {{ getMargePct(p) }}%
                  </span>
                </div>
              </div>

              <!-- Actions : menu 3 points via MatMenu (CDK Overlay) -->
              <div class="row-menu-wrap">
                <button class="menu-trigger" [matMenuTriggerFor]="rowMenu" [matMenuTriggerData]="{produit: p}" aria-label="Actions">
                  <mat-icon>more_vert</mat-icon>
                </button>
              </div>
            </div>

            <!-- Panel rentrée stock — juste sous CE produit -->
            <div class="reappro-panel" *ngIf="reapproId === p._id">
              <span class="reappro-label">Entrée stock — {{ p.nom }}</span>
              <div class="reappro-row">
                <button class="qty-btn" (click)="reapproQty = reapproQty > 1 ? reapproQty - 1 : 1">
                  <mat-icon>remove</mat-icon>
                </button>
                <span class="qty-val">+{{ reapproQty }}</span>
                <button class="qty-btn" (click)="reapproQty = reapproQty + 1">
                  <mat-icon>add</mat-icon>
                </button>
                <button class="reappro-confirm" (click)="confirmerReappro(p)" [disabled]="reapproSaving">
                  <mat-icon>{{ reapproSaving ? 'hourglass_empty' : 'check' }}</mat-icon>
                  Confirmer
                </button>
                <button class="reappro-cancel" (click)="reapproId = null">Annuler</button>
              </div>
            </div>
          </ng-container>

        </ng-container>

        <!-- Aucun résultat recherche -->
        <div class="no-results" *ngIf="groupedProduits().length === 0 && searchQuery()">
          <mat-icon>search_off</mat-icon>
          <p>Aucun produit pour "{{ searchQuery() }}"</p>
        </div>
      </div>
    </div>

    <!-- Mat-menu partagé pour toutes les rows — CDK Overlay gère le z-index automatiquement -->
    <mat-menu #rowMenu="matMenu" panelClass="shelf-row-menu">
      <ng-template matMenuContent let-p="produit">
        <button mat-menu-item (click)="ouvrirReappro(p)">
          <mat-icon>add_box</mat-icon> Entrée stock
        </button>
        <button mat-menu-item (click)="openEditDialog(p)">
          <mat-icon>edit</mat-icon> Modifier
        </button>
        <button mat-menu-item (click)="printBarcode(p)">
          <mat-icon>print</mat-icon> Imprimer étiquette
        </button>
        <mat-divider></mat-divider>
        <button mat-menu-item class="menu-danger" (click)="openDeleteDialog(p)">
          <mat-icon>delete</mat-icon> Supprimer
        </button>
      </ng-template>
    </mat-menu>
  `,
  styles: [`
    /* ── Page ── */
    .produits-page { max-width: 860px; margin: 0 auto; padding-bottom: 32px; }

    /* ── Header ── */
    .page-header {
      display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;
    }
    h1 {
      font-size: 22px; font-weight: 800; color: var(--text-1); margin: 0;
      display: flex; align-items: center; gap: 10px;
    }
    .produit-count {
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1);
      color: var(--text-3); font-size: 12px; font-weight: 600;
      padding: 2px 9px; border-radius: 20px;
    }
    .header-actions { display: flex; gap: 10px; }
    .btn-primary, .btn-secondary {
      flex: 1; padding: 11px 0; border-radius: 12px; border: none;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-primary { background: var(--accent); color: #04241c; }
    .btn-secondary {
      background: transparent; color: var(--text-2);
      border: 1px solid rgba(255,255,255,.1);
    }
    .btn-primary mat-icon, .btn-secondary mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ── Recherche ── */
    .search-bar {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
      border-radius: 12px; padding: 10px 14px; margin-bottom: 20px;
    }
    .search-bar mat-icon { color: var(--text-3); font-size: 20px; }
    .search-bar input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--text-1); font-size: 14px;
    }
    .search-bar input::placeholder { color: var(--text-3); }
    .clear-search {
      background: none; border: none; color: var(--text-3); cursor: pointer;
      display: flex; align-items: center; padding: 0;
    }

    /* ── Loading / Empty ── */
    .loading-center { display: flex; justify-content: center; padding: 60px; }
    .empty-state {
      text-align: center; padding: 60px 20px; color: var(--text-3);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }

    /* ── Shelf container ── */
    .shelf-container { display: flex; flex-direction: column; }

    /* ── Catégorie header ── */
    .cat-header {
      display: flex; align-items: center; gap: 8px;
      padding: 20px 4px 8px;
      border-bottom: 1px solid rgba(255,255,255,.05);
      margin-bottom: 4px;
    }
    .cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .cat-name {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: var(--text-3); flex: 1;
    }
    .cat-count {
      font-size: 11px; color: var(--text-3);
      background: rgba(255,255,255,.06); padding: 1px 7px;
      border-radius: 10px;
    }

    /* ── Shelf row ── */
    .shelf-row {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 10px; border-radius: 10px;
      position: relative; cursor: default;
      transition: background .12s;
    }
    .shelf-row:hover { background: rgba(255,255,255,.04); }
    .shelf-row.rupture { background: rgba(231,76,60,.05); }
    .shelf-row.alerte  { background: rgba(243,156,18,.04); }

    /* Avatar */
    .row-avatar {
      width: 42px; height: 42px; border-radius: 10px;
      border: 1px solid; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0;
      font-size: 16px; font-weight: 800;
    }

    /* Body */
    .row-body { flex: 1; min-width: 0; }
    .row-top {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-bottom: 3px;
    }
    .row-nom {
      font-size: 14px; font-weight: 600; color: var(--text-1);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 200px;
    }
    .row-bottom {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .row-prix { font-size: 13px; font-weight: 700; color: var(--accent); }
    .row-sep { color: var(--text-3); font-size: 11px; }
    .row-code { font-size: 11px; color: var(--text-3); font-family: monospace; }
    .row-marge { font-size: 11px; color: #a29bfe; font-weight: 600; }

    /* Badges stock */
    .stock-badge {
      font-size: 11px; font-weight: 700; padding: 2px 8px;
      border-radius: 20px; display: inline-flex; align-items: center; gap: 3px;
      white-space: nowrap;
    }
    .ok-badge     { background: rgba(0,184,148,.15); color: var(--accent); border: 1px solid rgba(0,184,148,.25); }
    .alerte-badge { background: rgba(243,156,18,.15); color: #f39c12; border: 1px solid rgba(243,156,18,.25); }
    .rupture-badge{ background: rgba(231,76,60,.15); color: #e74c3c; border: 1px solid rgba(231,76,60,.25); }
    .alerte-badge mat-icon { font-size: 11px; width: 11px; height: 11px; }

    /* ── Menu 3 points ── */
    .row-menu-wrap { flex-shrink: 0; }
    .menu-trigger {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: transparent; color: var(--text-3); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .12s;
    }
    .menu-trigger:hover { background: rgba(255,255,255,.08); color: var(--text-1); }
    .menu-trigger mat-icon { font-size: 20px; }

    /* ── Panel rentrée stock ── */
    .reappro-panel {
      margin: 4px 0 8px 54px;
      background: rgba(0,184,148,.08); border: 1px solid rgba(0,184,148,.2);
      border-radius: 10px; padding: 12px 14px;
      animation: slideIn .15s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .reappro-inner { display: flex; flex-direction: column; gap: 10px; }
    .reappro-label { font-size: 12px; color: var(--accent); font-weight: 600; }
    .reappro-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .qty-btn {
      width: 30px; height: 30px; border-radius: 8px; border: none;
      background: rgba(0,184,148,.2); color: var(--accent);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .qty-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .qty-val { font-size: 18px; font-weight: 700; color: var(--accent); min-width: 36px; text-align: center; }
    .reappro-confirm {
      padding: 7px 14px; border-radius: 8px; border: none;
      background: var(--accent); color: #04241c;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; gap: 4px;
    }
    .reappro-confirm:disabled { opacity: .5; cursor: not-allowed; }
    .reappro-confirm mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .reappro-cancel {
      padding: 7px 12px; border-radius: 8px;
      background: transparent; border: 1px solid rgba(255,255,255,.1);
      color: var(--text-3); font-size: 13px; cursor: pointer;
    }

    /* ── No results ── */
    .no-results { text-align: center; padding: 40px 20px; color: var(--text-3); }
    .no-results mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 8px; }
  `]
})
export class ProduitsComponent implements OnInit, OnDestroy {
  produits = signal<any[]>([]);
  isLoading = signal(false);
  isEmpty = computed(() => !this.isLoading() && this.produits().length === 0);
  private destroy$ = new Subject<void>();
  private dialog = inject(MatDialog);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private produitService = inject(ProduitService);

  searchQuery = signal('');
  reapproId: string | null = null;
  reapproQty = 1;
  reapproSaving = false;

  // Grouper par catégorie avec filtre recherche — computed() = stable entre cycles
  // de détection de changement tant que produits()/searchQuery() ne changent pas.
  // Avant: méthode appelée 2x dans le template → nouveau tableau à chaque cycle →
  // Angular redétruisait le *ngFor → le bouton mat-menu était démonté juste après
  // l'ouverture du menu, donc rien ne s'affichait jamais.
  groupedProduits = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.produits();
    const filtered = q
      ? all.filter(p =>
          p.nom?.toLowerCase().includes(q) ||
          p.codeBarres?.toLowerCase().includes(q) ||
          p.categorie?.toLowerCase().includes(q)
        )
      : all;

    const map = new Map<string, any[]>();
    for (const p of filtered) {
      const cat = p.categorie || 'Autre';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).map(([cat, items]) => ({
      categorie: cat,
      color: catColor(cat),
      initial: catInitial(cat),
      items,
    }));
  });

  ouvrirReappro(p: any): void {
    this.reapproId = this.reapproId === p._id ? null : p._id;
    this.reapproQty = 1;
  }

  trackByCategorie = (_: number, group: { categorie: string }) => group.categorie;
  trackByProduit = (_: number, p: any) => p._id;

  confirmerReappro(p: any): void {
    if (this.reapproSaving) return;
    this.reapproSaving = true;
    this.produitService.updateStock(p._id, this.reapproQty, 'entree').subscribe({
      next: () => {
        this.produits.update(list =>
          list.map(item => item._id === p._id ? { ...item, stock: item.stock + this.reapproQty } : item)
        );
        this.reapproId = null;
        this.reapproSaving = false;
        this.snack.open(`+${this.reapproQty} unité(s) ajoutée(s)`, 'OK', { duration: 2500 });
      },
      error: () => {
        this.reapproSaving = false;
        this.snack.open('Erreur réapprovisionnement', 'X', { duration: 2500 });
      }
    });
  }

  getMargePct(p: any): number {
    if (!p.prix || !p.prixAchat) return 0;
    return Math.round(((p.prix - p.prixAchat) / p.prix) * 100);
  }

  ngOnInit() { this.chargerProduits(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  chargerProduits() {
    this.isLoading.set(true);
    this.api.get('produits').pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.produits.set(res.data || res || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snack.open('Erreur chargement produits', 'OK', { duration: 3000 });
      },
    });
  }

  openAddDialog() {
    this.dialog.open(ProduitDialogComponent, {
      data: { isEdit: false },
      width: '540px',
      maxWidth: '100vw',
      panelClass: 'produit-dialog-panel',
    }).afterClosed().subscribe(result => { if (result) this.chargerProduits(); });
  }

  openEditDialog(produit: any) {
    this.dialog.open(ProduitDialogComponent, {
      data: { produit, isEdit: true },
      width: '540px',
      maxWidth: '100vw',
      panelClass: 'produit-dialog-panel',
    }).afterClosed().subscribe(result => { if (result) this.chargerProduits(); });
  }

  openDeleteDialog(produit: any) {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Supprimer le produit',
        message: `Voulez-vous vraiment supprimer "${produit.nom}" ?`,
        confirmText: 'Supprimer', cancelText: 'Annuler', confirmColor: 'warn',
      },
    }).afterClosed().subscribe(confirmed => { if (confirmed) this.deleteProduit(produit); });
  }

  deleteProduit(produit: any) {
    this.api.delete(`produits/${produit._id}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.produits.update(list => list.filter(p => p._id !== produit._id));
        this.snack.open('Produit supprimé', 'OK', { duration: 2000 });
      },
      error: () => this.snack.open('Erreur suppression', 'OK', { duration: 3000 }),
    });
  }

  printBarcode(produit: any) {
    if (!produit.codeBarres) {
      this.snack.open("Ce produit n'a pas de code-barres", 'OK', { duration: 3000 });
      return;
    }
    this.api.getBlob(`produits/${produit._id}/barcode`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const barcodeUrl = URL.createObjectURL(blob);
        const printWindow = window.open('', '_blank', 'width=420,height=640');
        if (!printWindow) { URL.revokeObjectURL(barcodeUrl); return; }
        printWindow.document.write(`<html><head><title>Étiquette</title>
          <style>@page{margin:0}body{margin:0;font-family:Arial}
          .sheet{width:58mm;margin:0 auto;text-align:center;padding:6mm 0}
          img{max-width:100%;height:auto;display:block;margin:0 auto}
          .name{margin-top:4mm;font-size:12px;font-weight:600}</style></head>
          <body onload="window.print();setTimeout(()=>window.close(),150)">
          <div class="sheet"><img src="${barcodeUrl}"/><div class="name">${produit.nom||''}</div></div>
          </body></html>`);
        printWindow.document.close();
        printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(barcodeUrl), { once: true });
      },
      error: () => this.snack.open('Erreur génération code-barres', 'OK', { duration: 3000 }),
    });
  }
}
