import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ProduitDialogComponent } from './produit-dialog.component';
import { ProduitService } from './produit.service';

@Component({
  selector: 'app-produits',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatDialogModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="produits-page">
      <div class="page-header">
        <h1>Produits</h1>
        <div class="header-actions">
          <button mat-stroked-button color="primary" routerLink="/patron/produits/scanner" class="btn-scanner">
            <mat-icon>qr_code_scanner</mat-icon> Scanner
          </button>
          <button
            mat-raised-button
            color="primary"
            (click)="openAddDialog()"
            [class.attention-animate]="isEmpty()"
            class="btn-ajouter"
          >
            <mat-icon>add</mat-icon> Ajouter
          </button>
        </div>
      </div>

      <div class="loading-center" *ngIf="isLoading()">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <div class="empty-state" *ngIf="isEmpty()">
        <mat-icon>inventory_2</mat-icon>
        <p>Aucun produit. Ajoutez votre premier produit.</p>
        <p class="empty-hint">Pour ajouter un produit, cliquez sur le bouton "Ajouter" en haut.</p>
      </div>

      <div class="produits-grid" *ngIf="!isLoading() && produits().length > 0">
        <div
          class="produit-card"
          *ngFor="let p of produits()"
          [class.stock-bas]="p.stock <= p.seuilAlerte"
        >
          <div class="produit-header">
            <span class="produit-nom">{{ p.nom }}</span>
            <span class="badge-alerte" *ngIf="p.stock <= p.seuilAlerte">Stock bas</span>
          </div>
          <div class="produit-prix">{{ p.prix | number: '1.0-0' }} FCFA</div>
          <div class="produit-marge" *ngIf="p.prixAchat">
            Marge : {{ p.prix - p.prixAchat | number: '1.0-0' }} FCFA
            <span class="marge-pct">({{ getMargePct(p) }}%)</span>
          </div>
          <div class="produit-stock">Stock : {{ p.stock }} unités</div>
          <div class="produit-categorie">{{ p.categorie }}</div>
          <div class="produit-code" *ngIf="p.codeBarres">
            <mat-icon>qr_code</mat-icon> {{ p.codeBarres }}
          </div>

          <!-- Panel rentrée stock inline -->
          <div class="reappro-panel" *ngIf="reapproId === p._id">
            <div class="reappro-row">
              <button class="qty-btn" (click)="reapproQty = reapproQty > 1 ? reapproQty - 1 : 1">
                <mat-icon>remove</mat-icon>
              </button>
              <span class="qty-val">+{{ reapproQty }}</span>
              <button class="qty-btn" (click)="reapproQty = reapproQty + 1">
                <mat-icon>add</mat-icon>
              </button>
            </div>
            <div class="reappro-btns">
              <button class="reappro-cancel" (click)="reapproId = null">Annuler</button>
              <button class="reappro-confirm" (click)="confirmerReappro(p)" [disabled]="reapproSaving">
                <mat-icon>{{ reapproSaving ? 'hourglass_empty' : 'add_box' }}</mat-icon>
                Confirmer
              </button>
            </div>
          </div>

          <div class="produit-actions">
            <button mat-icon-button (click)="ouvrirReappro(p)" matTooltip="Rentrée de stock" class="btn-reappro">
              <mat-icon>add_circle</mat-icon>
            </button>
            <button mat-icon-button color="primary" matTooltip="Modifier" (click)="openEditDialog(p)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="accent" matTooltip="Imprimer étiquette" (click)="printBarcode(p)">
              <mat-icon>print</mat-icon>
            </button>
            <button mat-icon-button color="warn" matTooltip="Supprimer" (click)="openDeleteDialog(p)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .produits-page {
        max-width: 800px;
        margin: 0 auto;
      }
      .page-header {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      .header-actions {
        display: flex;
        gap: 10px;
      }
      .btn-scanner {
        flex: 1;
      }
      .btn-ajouter {
        flex: 1;
      }
      .page-header h1 {
        font-size: 22px;
        font-weight: 700;
        margin: 0;
        color: var(--text-1);
      }
      .loading-center {
        display: flex;
        justify-content: center;
        padding: 60px;
      }
      .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-2);
      }
      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
      }
      .empty-hint {
        font-size: 13px;
        color: var(--text-3);
        margin-top: 10px;
      }
      .attention-animate {
        animation: pulseShake 0.42s ease-in-out 3;
      }
      @keyframes pulseShake {
        0% {
          transform: translateX(0) scale(1);
        }
        20% {
          transform: translateX(-2px) scale(1.03);
        }
        40% {
          transform: translateX(2px) scale(1.03);
        }
        60% {
          transform: translateX(-1px) scale(1.01);
        }
        80% {
          transform: translateX(1px) scale(1.01);
        }
        100% {
          transform: translateX(0) scale(1);
        }
      }
      .produits-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .produit-card {
        background: white;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #e9ecef;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 180px;
      }
      .produit-card.stock-bas {
        border-color: #e17055;
        background: #fff5f3;
      }
      .produit-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      .produit-nom {
        font-weight: 600;
        font-size: 15px;
        color: #1a1a2e;
      }
      .badge-alerte {
        background: #e17055;
        color: white;
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 20px;
      }
      .produit-prix {
        font-size: 16px;
        font-weight: 700;
        color: #00b894;
        margin-bottom: 4px;
      }
      .produit-marge {
        font-size: 12px;
        color: #8892a4;
        margin-bottom: 4px;
      }
      .produit-marge .marge-pct {
        color: #00b894;
        font-weight: 600;
      }
      .produit-stock {
        font-size: 13px;
        color: #6c757d;
        margin-bottom: 4px;
      }
      .produit-categorie {
        font-size: 12px;
        color: #adb5bd;
        margin-bottom: 8px;
      }
      .produit-code {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #6c757d;
        margin-bottom: 8px;
      }
      .produit-code mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
      .produit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
        margin-top: auto;
        padding-top: 8px;
      }
      .btn-reappro { color: var(--accent) !important; }

      /* Panel rentrée stock inline */
      .reappro-panel {
        margin: 8px 0 4px;
        background: var(--accent-lite);
        border: 1px solid rgba(0,184,148,.25);
        border-radius: 10px;
        padding: 10px 12px;
        animation: slideIn .15s ease-out;
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .reappro-row {
        display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;
      }
      .qty-btn {
        width: 30px; height: 30px; border-radius: 8px; border: none;
        background: rgba(0,184,148,.2); color: var(--accent);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
      }
      .qty-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .qty-val { font-size: 18px; font-weight: 700; color: var(--accent); min-width: 36px; text-align: center; }
      .reappro-btns { display: flex; gap: 8px; }
      .reappro-cancel {
        flex: 1; padding: 7px; border-radius: 8px; border: 1px solid var(--navy-border);
        background: transparent; color: var(--text-3); cursor: pointer; font-size: 13px;
      }
      .reappro-confirm {
        flex: 2; padding: 7px; border-radius: 8px; border: none;
        background: var(--accent); color: #fff; cursor: pointer; font-size: 13px; font-weight: 700;
        display: flex; align-items: center; justify-content: center; gap: 4px;
      }
      .reappro-confirm:disabled { opacity: .6; cursor: not-allowed; }
      .reappro-confirm mat-icon { font-size: 16px; width: 16px; height: 16px; }

      @media (max-width: 480px) {
        .produits-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
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

  // Rentrée de stock inline
  reapproId: string | null = null;
  reapproQty = 1;
  reapproSaving = false;

  ouvrirReappro(p: any): void {
    this.reapproId = this.reapproId === p._id ? null : p._id;
    this.reapproQty = 1;
  }

  confirmerReappro(p: any): void {
    if (this.reapproSaving) return;
    this.reapproSaving = true;
    this.produitService.updateStock(p._id, this.reapproQty, 'entree').subscribe({
      next: () => {
        this.produits.update(list =>
          list.map(item => item._id === p._id
            ? { ...item, stock: item.stock + this.reapproQty }
            : item
          )
        );
        this.reapproId = null;
        this.reapproSaving = false;
        this.snack.open(`+${this.reapproQty} unité(s) ajoutée(s) au stock`, '✓', { duration: 2500 });
      },
      error: () => {
        this.reapproSaving = false;
        this.snack.open('Erreur lors du réapprovisionnement', 'X', { duration: 2500 });
      }
    });
  }

  ngOnInit() {
    this.chargerProduits();
  }

  getMargePct(p: any): number {
    if (!p.prix || !p.prixAchat) return 0;
    return Math.round(((p.prix - p.prixAchat) / p.prix) * 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  chargerProduits() {
    setTimeout(() => {
      this.isLoading.set(true);
      this.api
        .get('produits')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            this.produits.set(res.data || res || []);
            this.isLoading.set(false);
          },
          error: () => {
            this.isLoading.set(false);
            this.snack.open('Erreur chargement produits', 'OK', { duration: 3000 });
          },
        });
    }, 0);
  }

  openAddDialog() {
    const dialogRef = this.dialog.open(ProduitDialogComponent, {
      data: { isEdit: false },
      width: '500px',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        setTimeout(() => this.chargerProduits(), 0);
      }
    });
  }

  openEditDialog(produit: any) {
    const dialogRef = this.dialog.open(ProduitDialogComponent, {
      data: { produit, isEdit: true },
      width: '500px',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        setTimeout(() => this.chargerProduits(), 0);
      }
    });
  }

  openDeleteDialog(produit: any) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Supprimer le produit',
        message: `Voulez-vous vraiment supprimer "${produit.nom}" ?`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        confirmColor: 'warn',
      },
    });
    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteProduit(produit);
      }
    });
  }

  deleteProduit(produit: any) {
    this.api
      .delete(`produits/${produit._id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.produits.update((list) => list.filter((p) => p._id !== produit._id));
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
    this.api
      .getBlob(`produits/${produit._id}/barcode`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const barcodeUrl = URL.createObjectURL(blob);
          const printWindow = window.open('', '_blank', 'width=420,height=640');
          if (!printWindow) {
            URL.revokeObjectURL(barcodeUrl);
            this.snack.open("Impossible d'ouvrir la fenêtre d'impression", 'OK', { duration: 3000 });
            return;
          }

          printWindow.document.write(`
            <html>
              <head>
                <title>Impression code-barres</title>
                <style>
                  @page { margin: 0; }
                  body { margin: 0; font-family: Arial, sans-serif; }
                  .sheet { width: 58mm; margin: 0 auto; text-align: center; padding: 6mm 0; }
                  .sheet.large { width: 80mm; }
                  img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
                  .name { margin-top: 4mm; font-size: 12px; font-weight: 600; }
                </style>
              </head>
              <body onload="window.print(); setTimeout(() => window.close(), 150);">
                <div class="sheet">
                  <img src="${barcodeUrl}" alt="Code-barres" />
                  <div class="name">${produit.nom || ''}</div>
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(barcodeUrl), { once: true });
        },
        error: () => this.snack.open("Erreur lors de la génération du code-barres", 'OK', { duration: 3000 }),
      });
  }
}
