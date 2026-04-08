import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Produit, ProduitService } from './produit.service';

@Component({
  selector: 'app-produit-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="form-page">
      <mat-card>
        <div class="form-header">
          <div>
            <h1>{{ isEditMode ? 'Modifier un produit' : 'Ajouter un produit' }}</h1>
            <p>
              {{
                isEditMode
                  ? 'Mettez à jour les informations du produit.'
                  : 'Créez un nouveau produit pour votre catalogue.'
              }}
            </p>
          </div>
          <a mat-button routerLink="/patron/produits">
            <mat-icon>arrow_back</mat-icon>
            Retour
          </a>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="field-row">
            <mat-form-field appearance="fill" class="field-full">
              <mat-label>Nom</mat-label>
              <input matInput formControlName="nom" placeholder="Nom du produit" />
            </mat-form-field>
          </div>

          <div class="field-row">
            <mat-form-field appearance="fill" class="field-half">
              <mat-label>Prix (FCFA)</mat-label>
              <input matInput type="number" formControlName="prix" placeholder="Prix" />
            </mat-form-field>
            <mat-form-field appearance="fill" class="field-half">
              <mat-label>Stock</mat-label>
              <input matInput type="number" formControlName="stock" placeholder="Quantité" />
            </mat-form-field>
          </div>

          <div class="field-row">
            <mat-form-field appearance="fill" class="field-half">
              <mat-label>Catégorie</mat-label>
              <input matInput formControlName="categorie" placeholder="Catégorie" />
            </mat-form-field>
            <mat-form-field appearance="fill" class="field-half">
              <mat-label>Code-barres</mat-label>
              <input matInput formControlName="codeBarres" placeholder="Optionnel" />
            </mat-form-field>
          </div>

          <div class="actions-row">
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || isLoading"
            >
              {{ isEditMode ? 'Mettre à jour' : 'Enregistrer' }}
            </button>
            <button mat-stroked-button color="accent" type="button" (click)="onScan()">
              <mat-icon>qr_code_scanner</mat-icon>
              Scanner code-barres
            </button>
          </div>
        </form>

        <div class="loader-overlay" *ngIf="isLoading">
          <mat-progress-spinner mode="indeterminate" diameter="48"></mat-progress-spinner>
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .form-page {
        padding: 16px;
      }
      .form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      h1 {
        margin: 0;
        font-size: 24px;
      }
      p {
        margin: 6px 0 0;
        color: #6c757d;
      }
      .field-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .field-full {
        width: 100%;
      }
      .field-half {
        width: min(100%, 320px);
      }
      .actions-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 24px;
      }
      .loader-overlay {
        display: flex;
        justify-content: center;
        margin-top: 24px;
      }
      @media (max-width: 720px) {
        .field-row {
          flex-direction: column;
        }
        .field-half {
          width: 100%;
        }
      }
    `,
  ],
})
export class ProduitFormComponent implements OnInit {
  form: FormGroup;
  isLoading = false;
  isEditMode = false;
  produitId?: string;

  constructor(
    private fb: FormBuilder,
    private produitService: ProduitService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      prix: [0, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      categorie: ['', Validators.required],
      codeBarres: [''],
    });
  }

  ngOnInit(): void {
    this.produitId = this.route.snapshot.paramMap.get('id') ?? undefined;
    this.isEditMode = !!this.produitId;
    if (this.isEditMode && this.produitId) {
      this.loadProduit(this.produitId);
    }
  }

  loadProduit(id: string): void {
    this.isLoading = true;
    this.produitService.getById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.form.patchValue(res.data);
        } else {
          this.snackBar.open(res.message || 'Produit introuvable', 'Fermer', { duration: 3000 });
          this.router.navigate(['/patron/produits']);
        }
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Erreur lors du chargement du produit', 'Fermer', { duration: 3000 });
        this.router.navigate(['/patron/produits']);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    const produit: Produit = this.form.value;
    this.isLoading = true;

    const request =
      this.isEditMode && this.produitId
        ? this.produitService.update(this.produitId, produit)
        : this.produitService.create(produit);

    request.subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.snackBar.open(this.isEditMode ? 'Produit mis à jour' : 'Produit ajouté', 'Fermer', {
            duration: 3000,
          });
          this.router.navigate(['/patron/produits']);
        } else {
          this.snackBar.open(res.message || 'Impossible d’enregistrer le produit', 'Fermer', {
            duration: 3000,
          });
        }
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Erreur réseau lors de l’enregistrement', 'Fermer', { duration: 3000 });
      },
    });
  }

  onScan(): void {
    this.snackBar.open('Scanner code-barres non disponible pour le moment', 'Fermer', {
      duration: 3000,
    });
  }
}
