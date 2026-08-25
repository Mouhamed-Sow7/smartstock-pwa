import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FournisseurService, Fournisseur, Achat, LigneAchat } from './fournisseur.service';
import { ProduitService } from '../produits/produit.service';

@Component({
  selector: 'app-fournisseurs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  template: `
    <div class="page">
      <div class="page-header">
        <a routerLink="/patron/dashboard" class="back-link"><mat-icon>arrow_back</mat-icon></a>
        <div>
          <div class="page-title">Fournisseurs</div>
          <div class="page-sub">Qui vous fournit quoi, et l'historique de vos factures</div>
        </div>
      </div>

      <!-- Liste des fournisseurs -->
      <div class="fourn-grid" *ngIf="!fournisseurOuvert">
        <button class="fourn-card add" (click)="ouvrirCreationFournisseur()">
          <mat-icon>add</mat-icon><span>Nouveau fournisseur</span>
        </button>
        <button class="fourn-card" *ngFor="let f of fournisseurs" (click)="ouvrirFournisseur(f)">
          <div class="fourn-avatar">{{ (f.nom || '?')[0] }}</div>
          <div class="fourn-nom">{{ f.nom }}</div>
          <div class="fourn-tel" *ngIf="f.telephone">{{ f.telephone }}</div>
        </button>
        <p class="empty-hint" *ngIf="!chargement && fournisseurs.length === 0">Aucun fournisseur enregistré pour l'instant.</p>
      </div>

      <!-- Formulaire nouveau fournisseur -->
      <div class="form-card" *ngIf="modeCreationFournisseur">
        <h4>Nouveau fournisseur</h4>
        <div class="f-grp"><label>Nom</label><input class="fx-inp" [(ngModel)]="nfForm.nom" placeholder="Nom du fournisseur" /></div>
        <div class="f-grp"><label>Téléphone</label><input class="fx-inp" [(ngModel)]="nfForm.telephone" /></div>
        <div class="f-grp"><label>Adresse (optionnel)</label><input class="fx-inp" [(ngModel)]="nfForm.adresse" /></div>
        <div class="form-actions">
          <button class="btn-ghost" (click)="modeCreationFournisseur = false">Annuler</button>
          <button class="btn-primary" (click)="confirmerCreationFournisseur()" [disabled]="!nfForm.nom?.trim() || busy">Créer</button>
        </div>
      </div>

      <!-- Fiche fournisseur ouverte -->
      <div class="fourn-detail" *ngIf="fournisseurOuvert as f">
        <div class="detail-header">
          <button class="btn-ghost sm" (click)="fermerFournisseur()"><mat-icon>arrow_back</mat-icon> Fournisseurs</button>
        </div>
        <div class="detail-card">
          <div class="detail-nom">{{ f.nom }}</div>
          <div class="detail-meta" *ngIf="f.telephone">{{ f.telephone }}</div>
          <div class="detail-meta" *ngIf="f.adresse">{{ f.adresse }}</div>
          <div class="detail-total">
            <span>Total acheté</span>
            <b>{{ totalAchatsFournisseur() | number:'1.0-0' }} FCFA</b>
          </div>
          <div class="detail-actions">
            <button class="btn-primary" (click)="ouvrirNouvelleFacture()"><mat-icon>receipt_long</mat-icon> Nouvelle facture</button>
            <button class="btn-ghost sm" (click)="supprimerFournisseur(f)"><mat-icon>delete_outline</mat-icon></button>
          </div>
        </div>

        <!-- Historique des factures -->
        <div class="section-title" *ngIf="achatsDuFournisseur.length">Factures</div>
        <div class="achat-row" *ngFor="let a of achatsDuFournisseur">
          <div class="achat-top">
            <span class="achat-date">{{ a.date | date:'dd/MM/yyyy' }}</span>
            <span class="achat-num" *ngIf="a.numeroFacture">Facture {{ a.numeroFacture }}</span>
            <span class="achat-montant">{{ a.montantTotal | number:'1.0-0' }} FCFA</span>
          </div>
          <div class="achat-lignes">
            <span class="ligne-chip" *ngFor="let l of a.lignes">{{ l.nom }} ×{{ l.quantite }}</span>
          </div>
          <button class="btn-supp-achat" (click)="supprimerAchat(a)"><mat-icon>delete_outline</mat-icon></button>
        </div>
        <p class="empty-hint" *ngIf="!chargementAchats && achatsDuFournisseur.length === 0">Aucune facture enregistrée pour ce fournisseur.</p>
      </div>

      <!-- Formulaire nouvelle facture -->
      <div class="facture-overlay" *ngIf="modeNouvelleFacture" (click)="$event.target === $event.currentTarget && (modeNouvelleFacture = false)">
        <div class="facture-modal">
          <div class="modal-head"><h3>Nouvelle facture — {{ fournisseurOuvert?.nom }}</h3><button class="btn-ico" (click)="modeNouvelleFacture = false"><mat-icon>close</mat-icon></button></div>

          <div class="f-row">
            <div class="f-grp"><label>Date</label><input class="fx-inp" type="date" [(ngModel)]="factureForm.date" /></div>
            <div class="f-grp"><label>N° facture (optionnel)</label><input class="fx-inp" [(ngModel)]="factureForm.numeroFacture" /></div>
          </div>

          <div class="lignes-header">
            <span>Produit</span><span>Qté</span><span>P.U.</span><span>Total</span><span></span>
          </div>
          <div class="ligne-row" *ngFor="let l of factureForm.lignes; let i = index">
            <div class="ligne-nom-wrap">
              <input class="fx-inp" [(ngModel)]="l.nom" placeholder="Nom du produit" (ngModelChange)="chercherSuggestion(i, $event)" (focus)="ligneActive = i" />
              <div class="suggestions" *ngIf="ligneActive === i && suggestions.length">
                <button *ngFor="let s of suggestions" (click)="lierProduit(i, s)">{{ s.nom }} <span>{{ s.prixAchat || s.prix | number:'1.0-0' }} F</span></button>
              </div>
            </div>
            <input class="fx-inp sm" type="number" min="0" [(ngModel)]="l.quantite" (ngModelChange)="recalculerLigne(i)" />
            <input class="fx-inp sm" type="number" min="0" [(ngModel)]="l.prixUnitaire" (ngModelChange)="recalculerLigne(i)" />
            <span class="ligne-total">{{ l.total | number:'1.0-0' }}</span>
            <button class="btn-ico" (click)="retirerLigne(i)"><mat-icon>close</mat-icon></button>
          </div>
          <button class="btn-ghost sm" (click)="ajouterLigne()"><mat-icon>add</mat-icon> Ajouter une ligne</button>

          <div class="facture-total">
            <span>Total facture</span><b>{{ totalFactureForm() | number:'1.0-0' }} FCFA</b>
          </div>

          <p class="idx-error" *ngIf="factureErr">{{ factureErr }}</p>
          <div class="modal-foot">
            <button class="btn-ghost" (click)="modeNouvelleFacture = false">Annuler</button>
            <button class="btn-primary" (click)="confirmerFacture()" [disabled]="busy || !factureValide()">
              <mat-icon>save</mat-icon> Enregistrer la facture
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 640px; margin: 0 auto; padding: 16px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .back-link { color: var(--text-3); display: flex; }
    .page-title { font-size: 17px; font-weight: 700; color: var(--text-1); }
    .page-sub { font-size: 12px; color: var(--text-3); }

    .fourn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .fourn-card {
      background: var(--navy-card, #0f1b2d); border: 1px solid var(--navy-border, rgba(255,255,255,.07));
      border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 6px;
      cursor: pointer; color: var(--text-1);
    }
    .fourn-card.add { color: #00b894; border-style: dashed; justify-content: center; }
    .fourn-avatar { width: 36px; height: 36px; border-radius: 10px; background: rgba(253,203,110,.15); color: #fdcb6e; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .fourn-nom { font-size: 13px; font-weight: 600; text-align: center; }
    .fourn-tel { font-size: 11px; color: var(--text-3); }
    .empty-hint { color: var(--text-3); font-size: 13px; text-align: center; padding: 30px 0; grid-column: 1/-1; }

    .form-card, .detail-card { background: var(--navy-card, #0f1b2d); border: 1px solid var(--navy-border, rgba(255,255,255,.07)); border-radius: 14px; padding: 16px; margin-top: 10px; }
    .form-card h4 { margin: 0 0 10px; font-size: 14px; color: var(--text-1); }
    .f-grp { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
    .f-grp label { font-size: 11px; color: var(--text-3); }
    .fx-inp { width: 100%; box-sizing: border-box; padding: 9px 10px; background: var(--navy, #0a1420); border: 1px solid var(--navy-border, rgba(255,255,255,.1)); border-radius: 9px; color: var(--text-1); font-size: 13px; }
    .form-actions, .modal-foot { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

    .detail-header { margin-bottom: 10px; }
    .detail-nom { font-size: 16px; font-weight: 700; color: var(--text-1); }
    .detail-meta { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .detail-total { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; padding-top: 10px; border-top: 1px dashed var(--navy-border, rgba(255,255,255,.1)); font-size: 13px; color: var(--text-2); }
    .detail-total b { color: #00b894; font-size: 16px; }
    .detail-actions { display: flex; gap: 8px; }
    .detail-actions .btn-primary { flex: 1; }

    .section-title { font-size: 12px; font-weight: 700; color: var(--text-3); text-transform: uppercase; margin: 16px 0 8px; }
    .achat-row { position: relative; background: var(--navy-card, #0f1b2d); border: 1px solid var(--navy-border, rgba(255,255,255,.07)); border-radius: 12px; padding: 12px 36px 12px 12px; margin-bottom: 8px; }
    .achat-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
    .achat-date { color: var(--text-2); font-weight: 600; }
    .achat-num { color: var(--text-3); }
    .achat-montant { margin-left: auto; font-weight: 700; color: #00b894; }
    .achat-lignes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .ligne-chip { background: var(--navy, #0a1420); border-radius: 8px; padding: 3px 8px; font-size: 11px; color: var(--text-3); }
    .btn-supp-achat { position: absolute; top: 10px; right: 8px; background: transparent; border: none; color: var(--text-3); cursor: pointer; }

    .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; background: #00b894; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-ghost { padding: 10px 16px; background: transparent; color: var(--text-2); border: 1px solid var(--navy-border, rgba(255,255,255,.1)); border-radius: 10px; font-size: 13px; cursor: pointer; }
    .btn-ghost.sm { padding: 6px 10px; font-size: 12px; }
    .btn-ico { width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: var(--text-3); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-primary mat-icon, .btn-ghost mat-icon, .btn-ico mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .facture-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 16px; }
    .facture-modal { background: var(--navy-card, #0f1b2d); border: 1px solid var(--navy-border, rgba(255,255,255,.1)); border-radius: 18px; padding: 20px; width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .modal-head h3 { margin: 0; font-size: 15px; color: var(--text-1); }
    .f-row { display: flex; gap: 10px; }
    .f-row .f-grp { flex: 1; }

    .lignes-header { display: grid; grid-template-columns: 2fr 50px 60px 60px 26px; gap: 6px; font-size: 10px; color: var(--text-3); text-transform: uppercase; margin: 10px 0 4px; padding: 0 2px; }
    .ligne-row { display: grid; grid-template-columns: 2fr 50px 60px 60px 26px; gap: 6px; align-items: center; margin-bottom: 6px; }
    .ligne-row .fx-inp.sm { padding: 8px 6px; font-size: 12px; }
    .ligne-nom-wrap { position: relative; }
    .ligne-total { font-size: 12px; font-weight: 600; color: var(--text-2); text-align: right; }
    .suggestions { position: absolute; top: 100%; left: 0; right: 0; z-index: 10; background: var(--navy, #0a1420); border: 1px solid var(--navy-border, rgba(255,255,255,.15)); border-radius: 8px; margin-top: 3px; max-height: 160px; overflow-y: auto; }
    .suggestions button { display: flex; justify-content: space-between; width: 100%; padding: 8px 10px; background: transparent; border: none; color: var(--text-1); font-size: 12px; cursor: pointer; text-align: left; }
    .suggestions button:hover { background: rgba(255,255,255,.05); }
    .suggestions button span { color: var(--text-3); }

    .facture-total { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--navy-border, rgba(255,255,255,.1)); font-size: 13px; color: var(--text-2); }
    .facture-total b { color: #00b894; font-size: 16px; }
    .idx-error { color: #e74c3c; font-size: 12px; margin-top: 8px; }
  `],
})
export class FournisseursComponent implements OnInit {
  fournisseurs: Fournisseur[] = [];
  chargement = false;
  busy = false;

  modeCreationFournisseur = false;
  nfForm: Partial<Fournisseur> = { nom: '', telephone: '', adresse: '' };

  fournisseurOuvert: Fournisseur | null = null;
  achatsDuFournisseur: Achat[] = [];
  chargementAchats = false;

  modeNouvelleFacture = false;
  factureForm: { date: string; numeroFacture: string; lignes: LigneAchat[] } = this.factureVide();
  factureErr = '';

  // Autocomplétion produit — voir décision du 24/08/2026 (nom libre
  // autorisé, lié au catalogue quand possible, jamais bloquant).
  private catalogue: any[] = [];
  ligneActive: number | null = null;
  suggestions: any[] = [];

  constructor(
    private fournisseurService: FournisseurService,
    private produitService: ProduitService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.chargerFournisseurs();
    this.produitService.getAll().subscribe({
      next: (res: any) => { this.catalogue = res?.data || res || []; },
      error: () => {},
    });
  }

  private factureVide() {
    return { date: new Date().toISOString().slice(0, 10), numeroFacture: '', lignes: [this.ligneVide()] };
  }
  private ligneVide(): LigneAchat { return { produitId: null, nom: '', quantite: 1, prixUnitaire: 0, total: 0 }; }

  chargerFournisseurs(): void {
    this.chargement = true;
    this.fournisseurService.getFournisseurs().subscribe({
      next: (res: any) => { this.chargement = false; this.fournisseurs = res?.data || []; },
      error: () => { this.chargement = false; },
    });
  }

  ouvrirCreationFournisseur(): void {
    this.nfForm = { nom: '', telephone: '', adresse: '' };
    this.modeCreationFournisseur = true;
  }

  confirmerCreationFournisseur(): void {
    if (!this.nfForm.nom?.trim()) return;
    this.busy = true;
    this.fournisseurService.createFournisseur(this.nfForm).subscribe({
      next: (res: any) => {
        this.busy = false;
        if (res?.success) {
          this.fournisseurs.push(res.data);
          this.modeCreationFournisseur = false;
        } else {
          this.snack.open(res?.message || 'Erreur', 'Fermer', { duration: 3000 });
        }
      },
      error: (err) => { this.busy = false; this.snack.open(err?.error?.message || 'Erreur réseau', 'Fermer', { duration: 3000 }); },
    });
  }

  ouvrirFournisseur(f: Fournisseur): void {
    this.fournisseurOuvert = f;
    this.chargementAchats = true;
    this.fournisseurService.getAchats(f._id).subscribe({
      next: (res: any) => { this.chargementAchats = false; this.achatsDuFournisseur = res?.data || []; },
      error: () => { this.chargementAchats = false; },
    });
  }

  fermerFournisseur(): void {
    this.fournisseurOuvert = null;
    this.achatsDuFournisseur = [];
  }

  totalAchatsFournisseur(): number {
    return this.achatsDuFournisseur.reduce((s, a) => s + (a.montantTotal || 0), 0);
  }

  supprimerFournisseur(f: Fournisseur): void {
    if (!f._id || !confirm(`Supprimer ${f.nom} ?`)) return;
    this.fournisseurService.deleteFournisseur(f._id).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.fournisseurs = this.fournisseurs.filter((x) => x._id !== f._id);
          this.fermerFournisseur();
        } else {
          this.snack.open(res?.message || 'Erreur', 'Fermer', { duration: 3500 });
        }
      },
      error: (err) => this.snack.open(err?.error?.message || 'Erreur réseau', 'Fermer', { duration: 3500 }),
    });
  }

  // ─── Facture ─────────────────────────────────────────────────────
  ouvrirNouvelleFacture(): void {
    this.factureForm = this.factureVide();
    this.factureErr = '';
    this.modeNouvelleFacture = true;
  }

  ajouterLigne(): void { this.factureForm.lignes.push(this.ligneVide()); }
  retirerLigne(i: number): void {
    if (this.factureForm.lignes.length <= 1) return;
    this.factureForm.lignes.splice(i, 1);
  }
  recalculerLigne(i: number): void {
    const l = this.factureForm.lignes[i];
    l.total = Math.round((Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0));
  }

  chercherSuggestion(i: number, texte: string): void {
    this.factureForm.lignes[i].produitId = null; // toute frappe manuelle délie le produit précédent
    const t = (texte || '').trim().toLowerCase();
    this.suggestions = t.length < 2 ? [] : this.catalogue.filter((p) => (p.nom || '').toLowerCase().includes(t)).slice(0, 6);
  }

  lierProduit(i: number, produit: any): void {
    const l = this.factureForm.lignes[i];
    l.nom = produit.nom;
    l.produitId = produit._id;
    if (!l.prixUnitaire) l.prixUnitaire = produit.prixAchat || 0;
    this.recalculerLigne(i);
    this.suggestions = [];
    this.ligneActive = null;
  }

  totalFactureForm(): number {
    return this.factureForm.lignes.reduce((s, l) => s + (l.total || 0), 0);
  }

  factureValide(): boolean {
    return this.factureForm.lignes.some((l) => l.nom.trim() && l.quantite > 0 && l.prixUnitaire >= 0);
  }

  confirmerFacture(): void {
    if (!this.fournisseurOuvert?._id || !this.factureValide()) return;
    this.factureErr = '';
    this.busy = true;
    const lignes = this.factureForm.lignes.filter((l) => l.nom.trim() && l.quantite > 0);
    this.fournisseurService.createAchat({
      fournisseurId: this.fournisseurOuvert._id,
      date: this.factureForm.date,
      numeroFacture: this.factureForm.numeroFacture,
      lignes,
    }).subscribe({
      next: (res: any) => {
        this.busy = false;
        if (res?.success) {
          this.achatsDuFournisseur.unshift(res.data);
          this.modeNouvelleFacture = false;
        } else {
          this.factureErr = res?.message || 'Erreur';
        }
      },
      error: (err) => { this.busy = false; this.factureErr = err?.error?.message || 'Erreur réseau'; },
    });
  }

  supprimerAchat(a: Achat): void {
    if (!a._id || !confirm('Supprimer cette facture ?')) return;
    this.fournisseurService.deleteAchat(a._id).subscribe({
      next: (res: any) => {
        if (res?.success) this.achatsDuFournisseur = this.achatsDuFournisseur.filter((x) => x._id !== a._id);
        else this.snack.open(res?.message || 'Erreur', 'Fermer', { duration: 3000 });
      },
      error: (err) => this.snack.open(err?.error?.message || 'Erreur réseau', 'Fermer', { duration: 3000 }),
    });
  }
}
