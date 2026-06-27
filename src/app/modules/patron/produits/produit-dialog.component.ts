import { Component, inject, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { Produit, ProduitService } from './produit.service';

export interface ProduitDialogData {
  produit?: Produit;
  isEdit: boolean;
}

const CATEGORIES = [
  { label: 'Boissons',   icon: 'local_drink',     color: '#0984e3' },
  { label: 'Epicerie',   icon: 'kitchen',          color: '#00b894' },
  { label: 'Laitiers',   icon: 'egg_alt',          color: '#6c5ce7' },
  { label: 'Hygiene',    icon: 'soap',             color: '#fd79a8' },
  { label: 'Entretien',  icon: 'cleaning_services',color: '#fdcb6e' },
  { label: 'Snacks',     icon: 'cookie',           color: '#e17055' },
  { label: 'Frais',      icon: 'ac_unit',          color: '#55efc4' },
  { label: 'Telephonie', icon: 'smartphone',       color: '#a29bfe' },
  { label: 'Feculents',  icon: 'rice_bowl',        color: '#fab1a0' },
  { label: 'Autre',      icon: 'category',         color: '#636e72' },
];

@Component({
  selector: 'app-produit-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
  <div class="dialog-wrap">
    <!-- Header -->
    <div class="dlg-header">
      <div class="dlg-icon">
        <mat-icon>{{ data.isEdit ? 'edit' : 'add_box' }}</mat-icon>
      </div>
      <div>
        <div class="dlg-title">{{ data.isEdit ? 'Modifier le produit' : 'Nouveau produit' }}</div>
        <div class="dlg-sub" *ngIf="!data.isEdit">Remplissez les informations du produit</div>
      </div>
      <button class="dlg-close" (click)="onCancel()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="dlg-body">
      <form [formGroup]="form">

        <!-- Nom -->
        <div class="field-group">
          <label class="field-label">Nom du produit <span class="req">*</span></label>
          <input class="field-input" formControlName="nom" placeholder="Ex: Coca-Cola 1.5L" [class.error]="form.get('nom')?.invalid && form.get('nom')?.touched" />
          <span class="field-error" *ngIf="form.get('nom')?.invalid && form.get('nom')?.touched">Nom requis</span>
        </div>

        <!-- Prix ligne -->
        <div class="fields-row">
          <div class="field-group">
            <label class="field-label">Prix vente <span class="req">*</span></label>
            <div class="field-input-wrap">
              <input class="field-input" type="number" formControlName="prix" min="0" />
              <span class="field-suffix">FCFA</span>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Prix achat <span class="opt">optionnel</span></label>
            <div class="field-input-wrap">
              <input class="field-input" type="number" formControlName="prixAchat" min="0" />
              <span class="field-suffix">FCFA</span>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Stock <span class="req">*</span></label>
            <div class="field-input-wrap">
              <input class="field-input" type="number" formControlName="stock" min="0" />
              <span class="field-suffix">unités</span>
            </div>
          </div>
        </div>

        <!-- Marge preview -->
        <div class="marge-bar" *ngIf="margeUnitaire > 0">
          <mat-icon>trending_up</mat-icon>
          <span>Marge <strong>{{ margeUnitaire | number:'1.0-0' }} FCFA</strong></span>
          <span class="marge-pct">{{ margePourcent }}%</span>
        </div>

        <!-- Catégorie — chips -->
        <div class="field-group">
          <label class="field-label">Catégorie <span class="req">*</span></label>
          <div class="cat-grid">
            <button type="button" class="cat-chip"
              *ngFor="let c of categories"
              [class.selected]="selectedCat === c.label"
              [style.--cc]="c.color"
              (click)="selectCat(c.label)">
              <mat-icon>{{ c.icon }}</mat-icon>
              <span>{{ c.label }}</span>
            </button>
          </div>
          <!-- Saisie libre si "Autre" ou aucune sélection -->
          <div class="cat-custom" *ngIf="showCustomCat">
            <input class="field-input" [(ngModel)]="customCat" [ngModelOptions]="{standalone: true}"
              placeholder="Nom de la catégorie..." (input)="onCustomCatInput()" />
          </div>
        </div>

        <!-- Code-barres + seuil alerte -->
        <div class="fields-row">
          <div class="field-group">
            <label class="field-label">Code-barres <span class="opt">optionnel</span></label>
            <input class="field-input mono" formControlName="codeBarres" placeholder="Auto-généré si vide" />
          </div>
          <div class="field-group">
            <label class="field-label">Seuil alerte <span class="opt">optionnel</span></label>
            <div class="field-input-wrap">
              <input class="field-input" type="number" formControlName="seuilAlerte" min="0" placeholder="5" />
              <span class="field-suffix">unités</span>
            </div>
          </div>
        </div>

      </form>
    </div>

    <!-- Footer -->
    <div class="dlg-footer">
      <button class="btn-cancel" (click)="onCancel()" [disabled]="isLoading">Annuler</button>
      <button class="btn-save" (click)="onSave()" [disabled]="form.invalid || isLoading || !getCatValue()">
        <mat-spinner *ngIf="isLoading" diameter="16"></mat-spinner>
        <mat-icon *ngIf="!isLoading">{{ data.isEdit ? 'check' : 'add' }}</mat-icon>
        {{ data.isEdit ? 'Mettre à jour' : 'Créer le produit' }}
      </button>
    </div>
  </div>
  `,
  styles: [`
    :host { display: block; }
    .dialog-wrap {
      background: #0f1b2d;
      border-radius: 18px;
      overflow: hidden;
      width: min(540px, 100vw);
      display: flex; flex-direction: column;
      max-height: 92dvh;
    }
    /* Header */
    .dlg-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,.07);
    }
    .dlg-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(0,184,148,.15); border: 1px solid rgba(0,184,148,.25);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .dlg-icon mat-icon { color: #00b894; font-size: 20px; }
    .dlg-title { font-size: 16px; font-weight: 700; color: #e8eaf0; }
    .dlg-sub { font-size: 12px; color: #4a5568; margin-top: 1px; }
    .dlg-close {
      margin-left: auto; width: 32px; height: 32px; border-radius: 8px;
      border: none; background: rgba(255,255,255,.05); color: #4a5568;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .dlg-close:hover { background: rgba(255,255,255,.1); color: #e8eaf0; }
    .dlg-close mat-icon { font-size: 18px; }

    /* Body */
    .dlg-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; flex: 1; }
    @media (max-width: 600px) {
      .dlg-body { padding: 12px 14px; gap: 10px; }
      .fields-row { flex-direction: column; gap: 10px; }
      .cat-grid { grid-template-columns: repeat(5, 1fr); gap: 5px; }
      .cat-chip { padding: 7px 2px; font-size: 9px; }
      .cat-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .dlg-header { padding: 14px 14px 12px; }
      .dlg-footer { padding: 10px 14px; }
      .field-input { padding: 9px 10px; font-size: 14px; }
    }

    /* Fields */
    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #4a5568; }
    .req { color: #e74c3c; }
    .opt { color: #636e72; font-size: 10px; text-transform: none; letter-spacing: 0; font-weight: 400; margin-left: 4px; }
    .field-input {
      width: 100%; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px; padding: 10px 12px; color: #e8eaf0; font-size: 14px; outline: none;
      transition: border-color .15s; box-sizing: border-box;
    }
    .field-input:focus { border-color: #00b894; }
    .field-input.error { border-color: #e74c3c; }
    .field-input.mono { font-family: monospace; font-size: 13px; }
    .field-input-wrap { position: relative; }
    .field-input-wrap .field-input { padding-right: 56px; }
    .field-suffix { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: #4a5568; font-weight: 600; white-space: nowrap; }
    .field-error { font-size: 11px; color: #e74c3c; }
    .fields-row { display: flex; gap: 10px; }
    .fields-row .field-group { flex: 1; min-width: 0; }

    /* Marge bar */
    .marge-bar {
      display: flex; align-items: center; gap: 8px;
      background: rgba(0,184,148,.08); border: 1px solid rgba(0,184,148,.2);
      border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #00b894;
    }
    .marge-bar mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .marge-pct { margin-left: auto; font-size: 12px; font-weight: 700; opacity: .8; }

    /* Catégorie chips */
    .cat-grid {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
    }
    @media (max-width: 420px) { .cat-grid { grid-template-columns: repeat(3, 1fr); } }
    .cat-chip {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 8px 4px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
      color: #8892a4; font-size: 10px; font-weight: 600;
      cursor: pointer; transition: all .15s;
    }
    .cat-chip mat-icon { font-size: 18px; width: 18px; height: 18px; color: inherit; }
    .cat-chip:hover { background: rgba(var(--cc), .1); border-color: color-mix(in srgb, var(--cc) 40%, transparent); color: var(--cc); }
    .cat-chip.selected {
      background: color-mix(in srgb, var(--cc) 15%, transparent);
      border-color: color-mix(in srgb, var(--cc) 50%, transparent);
      color: var(--cc);
    }
    .cat-custom { margin-top: 8px; }

    /* Footer */
    .dlg-footer {
      display: flex; gap: 10px; align-items: center;
      padding: 14px 20px; border-top: 1px solid rgba(255,255,255,.07);
    }
    .btn-cancel {
      padding: 10px 18px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,.1); background: transparent;
      color: #8892a4; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-cancel:hover { background: rgba(255,255,255,.05); }
    .btn-save {
      flex: 1; padding: 10px 18px; border-radius: 10px; border: none;
      background: #00b894; color: #04241c;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-save:disabled { opacity: .45; cursor: not-allowed; }
    .btn-save mat-icon { font-size: 17px; width: 17px; height: 17px; }
    mat-spinner { --mdc-circular-progress-active-indicator-color: #04241c; }
  `]
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

  categories = CATEGORIES;
  selectedCat: string | null = null;
  showCustomCat = false;
  customCat = '';

  constructor() {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      prix: [0, [Validators.required, Validators.min(0)]],
      prixAchat: [0, [Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      categorie: ['', Validators.required],
      codeBarres: [''],
      seuilAlerte: [5],
    });
  }

  ngOnInit(): void {
    if (this.data?.produit) {
      this.form.patchValue(this.data.produit);
      const cat = this.data.produit.categorie || '';
      const known = CATEGORIES.find(c => c.label === cat);
      if (known) {
        this.selectedCat = cat;
      } else if (cat) {
        this.selectedCat = 'Autre';
        this.showCustomCat = true;
        this.customCat = cat;
      }
      this.cdr.detectChanges();
    }
  }

  selectCat(label: string): void {
    this.selectedCat = label;
    this.showCustomCat = label === 'Autre';
    if (label !== 'Autre') {
      this.form.patchValue({ categorie: label });
      this.customCat = '';
    } else {
      this.form.patchValue({ categorie: this.customCat || '' });
    }
  }

  onCustomCatInput(): void {
    this.form.patchValue({ categorie: this.customCat });
  }

  getCatValue(): string {
    return this.form.get('categorie')?.value || '';
  }

  get margeUnitaire(): number {
    const prix = this.form.get('prix')?.value || 0;
    const prixAchat = this.form.get('prixAchat')?.value || 0;
    return prixAchat > 0 ? prix - prixAchat : 0;
  }

  get margePourcent(): number {
    const prix = this.form.get('prix')?.value || 0;
    if (!prix || this.margeUnitaire <= 0) return 0;
    return Math.round((this.margeUnitaire / prix) * 100);
  }

  onCancel(): void { this.dialogRef.close(null); }

  onSave(): void {
    if (this.form.invalid || !this.getCatValue()) return;
    this.isLoading = true;
    const produit: Produit = this.form.value;
    const request = this.data.isEdit && this.data.produit?._id
      ? this.produitService.update(this.data.produit._id, produit)
      : this.produitService.create(produit);
    request.pipe(finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open(this.data.isEdit ? 'Produit mis à jour' : 'Produit créé', 'OK', { duration: 2000 });
            this.dialogRef.close(res.data);
          } else {
            this.snackBar.open(res.message || 'Erreur', 'OK', { duration: 3000 });
          }
        },
        error: () => this.snackBar.open('Erreur réseau', 'OK', { duration: 3000 }),
      });
  }
}
