import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { Produit, ProduitService } from './produit.service';
export interface ProduitDialogData {
  produit?: Produit;
  isEdit: boolean;
}
@Component({
  selector: 'app-produit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.isEdit ? 'edit' : 'add' }}</mat-icon>
      {{ data.isEdit ? 'Modifier le produit' : 'Nouveau produit' }}
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="produit-form">
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>Nom du produit</mat-label>
          <input matInput formControlName="nom" placeholder="Nom" />
          <mat-error *ngIf="form.get('nom')?.hasError('required')"> Le nom est requis </mat-error>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="fill">
            <mat-label>Prix de vente (FCFA)</mat-label>
            <input matInput type="number" formControlName="prix" placeholder="Prix de vente" />
            <mat-error *ngIf="form.get('prix')?.hasError('required')">
              Le prix est requis
            </mat-error>
          </mat-form-field>
          <mat-form-field appearance="fill">
            <mat-label>Prix d'achat (FCFA)</mat-label>
            <input matInput type="number" formControlName="prixAchat" placeholder="Coût d'achat" />
            <mat-hint>Pour calculer la marge — laisser 0 si inconnu</mat-hint>
          </mat-form-field>
        </div>
        <div class="marge-preview" *ngIf="form.get('prixAchat')?.value > 0">
          <mat-icon>trending_up</mat-icon>
          <span>Marge unitaire : <strong>{{ margeUnitaire | number: '1.0-0' }} FCFA</strong>
            <span class="marge-pct">({{ margePourcent }}%)</span>
          </span>
        </div>
        <div class="row">
          <mat-form-field appearance="fill">
            <mat-label>Stock</mat-label>
            <input matInput type="number" formControlName="stock" placeholder="Quantité" />
            <mat-error *ngIf="form.get('stock')?.hasError('required')">
              Le stock est requis
            </mat-error>
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="fill">
            <mat-label>Catégorie</mat-label>
            <input matInput formControlName="categorie" placeholder="Catégorie" />
          </mat-form-field>
          <mat-form-field appearance="fill">
            <mat-label>Code-barres</mat-label>
            <input matInput formControlName="codeBarres" placeholder="Optionnel" />
            <mat-hint>Laisser vide pour génération automatique</mat-hint>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [disabled]="isLoading" (click)="onCancel()">Annuler</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="form.invalid || isLoading"
        (click)="onSave()"
      >
        <mat-spinner *ngIf="isLoading" diameter="20"></mat-spinner>
        <span *ngIf="!isLoading">{{ data.isEdit ? 'Mettre à jour' : 'Enregistrer' }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }
      mat-dialog-content {
        min-width: 400px;
        max-width: 500px;
      }
      .produit-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .full-width {
        width: 100%;
      }
      .row {
        display: flex;
        gap: 16px;
      }
      .row mat-form-field {
        flex: 1;
        min-width: 150px;
      }
      .marge-preview {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--accent-lite);
        border: 1px solid rgba(0, 184, 148, 0.25);
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        color: var(--accent);
        margin: -4px 0 4px;
      }
      .marge-preview mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .marge-pct {
        opacity: 0.8;
        font-size: 12px;
      }
      mat-dialog-actions {
        margin-top: 16px;
      }
      button[mat-raised-button] {
        min-width: 120px;
      }
      @media (max-width: 480px) {
        mat-dialog-content {
          min-width: auto;
        }
        .row {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ProduitDialogComponent implements OnInit {
  form: FormGroup;
  isLoading = false;
  data = inject<ProduitDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject<MatDialogRef<ProduitDialogComponent>>(MatDialogRef);
  private fb = inject(FormBuilder);
  private produitService = inject(ProduitService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  constructor() {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      prix: [0, [Validators.required, Validators.min(0)]],
      prixAchat: [0, [Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      categorie: ['', Validators.required],
      codeBarres: [''],
    });
  }
  ngOnInit(): void {
    if (this.data?.produit) {
      this.form.patchValue(this.data.produit);
      this.cdr.detectChanges();
    }
  }

  get margeUnitaire(): number {
    const prix = this.form.get('prix')?.value || 0;
    const prixAchat = this.form.get('prixAchat')?.value || 0;
    return prix - prixAchat;
  }

  get margePourcent(): number {
    const prix = this.form.get('prix')?.value || 0;
    if (!prix) return 0;
    return Math.round((this.margeUnitaire / prix) * 100);
  }
  onCancel(): void {
    this.dialogRef.close(null);
  }
  onSave(): void {
    if (this.form.invalid) {
      return;
    }
    this.isLoading = true;
    const produit: Produit = this.form.value;
    const request =
      this.data.isEdit && this.data.produit?._id
        ? this.produitService.update(this.data.produit._id, produit)
        : this.produitService.create(produit);
    request
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open(
              this.data.isEdit ? 'Produit mis à jour' : 'Produit ajouté',
              'Fermer',
              { duration: 2000 },
            );
            this.dialogRef.close(res.data);
          } else {
            this.snackBar.open(res.message || "Erreur lors de l'enregistrement", 'Fermer', {
              duration: 3000,
            });
          }
        },
        error: () => {
          this.snackBar.open('Erreur réseau', 'Fermer', { duration: 3000 });
        },
      });
  }
}
