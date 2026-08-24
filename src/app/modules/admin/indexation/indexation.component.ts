import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { environment } from '../../../../environments/environment';
import { checksumEanValide } from '../../../core/utils/barcode-checksum';

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

interface Patron { _id: string; nom: string; boutique?: string; tenantId: string; actif: boolean; }

interface ProduitAdmin {
  nom: string; prix: number; prixGros?: number; prixAchat?: number;
  categorie: string; image?: string; codeBarres?: string;
}
interface ProduitBoutiqueCible {
  _id: string; nom: string; prix: number; prixGros?: number; stock: number;
  stockGros?: number; modeStock?: 'separe' | 'lie'; uniteParGros?: number;
  categorie: string; seuilAlerte?: number; codeBarres?: string;
}

// État d'un scan traité : idle (rien / caméra active) -> l'un des 3 cas
// possibles une fois le lookup admin résolu (voir traiterCode()).
type EtatResultat = 'idle' | 'dejaLa' | 'connuAilleurs' | 'nouveau';

const CATEGORIES = ['Boissons', 'Epicerie', 'Laitiers', 'Hygiene', 'Entretien', 'Snacks', 'Frais', 'Telephonie', 'Feculents', 'Autre'];

@Component({
  selector: 'app-indexation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  template: `
    <div class="idx-page">
      <div class="idx-header">
        <a routerLink="/admin" class="back-link"><mat-icon>arrow_back</mat-icon></a>
        <div>
          <div class="idx-title">Indexation rapide</div>
          <div class="idx-sub">Rattraper une boutique sans cahier de stock</div>
        </div>
      </div>

      <!-- Étape 1 : sélection de la boutique cible, verrouillée pour la session -->
      <div class="boutique-lock" *ngIf="!boutiqueVerrouillee">
        <label class="idx-label">Boutique cible pour cette session</label>
        <select class="idx-select" [(ngModel)]="tenantIdChoisi">
          <option value="" disabled>{{ chargementPatrons ? 'Chargement…' : 'Choisir une boutique' }}</option>
          <option *ngFor="let p of patrons" [value]="p.tenantId">{{ p.boutique || p.nom }}</option>
        </select>
        <button class="btn-primary w100" [disabled]="!tenantIdChoisi" (click)="verrouillerBoutique()">
          <mat-icon>lock</mat-icon> Verrouiller et commencer
        </button>
      </div>

      <ng-container *ngIf="boutiqueVerrouillee">
        <div class="boutique-badge">
          <mat-icon>storefront</mat-icon>
          <span>{{ nomBoutiqueChoisie }}</span>
          <button class="chg-boutique" (click)="changerBoutique()">Changer</button>
        </div>

        <!-- Caméra -->
        <div class="camera-card">
          <div class="video-wrapper">
            <video #video muted playsinline></video>
            <div class="video-placeholder" *ngIf="!cameraActive">
              <mat-icon>{{ resultat !== 'idle' ? 'pause_circle' : isStarting ? 'hourglass_empty' : 'photo_camera' }}</mat-icon>
              <span>{{ resultat !== 'idle' ? 'En pause — reprend après validation' : isStarting ? 'Démarrage...' : 'Appuyez sur Démarrer' }}</span>
            </div>
            <div class="scan-frame" *ngIf="cameraActive">
              <div class="corner tl"></div><div class="corner tr"></div>
              <div class="corner bl"></div><div class="corner br"></div>
              <div class="scan-line"></div>
            </div>
            <!-- Spinner de détection — couvre l'appel réseau du lookup, entre
                 le code confirmé (checksum + double-lecture) et le résultat -->
            <div class="verif-overlay" *ngIf="isLoading && resultat === 'idle'">
              <mat-icon class="verif-spin">autorenew</mat-icon>
              <span>Recherche en cours...</span>
            </div>
          </div>
          <div class="camera-actions">
            <button class="btn-primary" (click)="demarrerScan()" [disabled]="cameraActive || isStarting || !cameraAvailable">
              {{ cameraActive ? 'Caméra active' : isStarting ? 'Démarrage...' : 'Démarrer' }}
            </button>
            <button class="btn-ghost" (click)="switchCamera()" [disabled]="!cameraActive">Basculer</button>
            <button class="btn-ghost" (click)="arreterManuellement()" [disabled]="!cameraActive">Arrêter</button>
          </div>
        </div>

        <div class="manual-wrapper">
          <input class="idx-select" type="text" [(ngModel)]="manualCode" (keyup.enter)="traiterCode(manualCode)"
            placeholder="Ou saisir le code-barres manuellement..." autocomplete="off" />
          <button class="btn-primary" (click)="traiterCode(manualCode)" [disabled]="!manualCode.trim() || isLoading">Vérifier</button>
        </div>

        <p class="idx-error" *ngIf="errorMessage">{{ errorMessage }}</p>

        <!-- Cas 1 : déjà indexé pour CETTE boutique -->
        <div class="result-card deja" *ngIf="resultat === 'dejaLa' && produitBoutiqueCible">
          <div class="result-head"><mat-icon>inventory</mat-icon><span>Déjà indexé pour {{ nomBoutiqueChoisie }}</span></div>
          <div class="produit-info">
            <div class="produit-nom">{{ produitBoutiqueCible.nom }}</div>
            <div class="produit-meta">
              {{ produitBoutiqueCible.prix | number:'1.0-0' }} FCFA &middot; Stock détail : {{ produitBoutiqueCible.stock }}
              <span *ngIf="(produitBoutiqueCible.prixGros || 0) > 0"> &middot; Stock gros : {{ stockGrosAffiche(produitBoutiqueCible) }}</span>
            </div>
          </div>
          <div class="deja-actions" *ngIf="!modeAjoutStock && !modeEdition">
            <button class="btn-primary" (click)="ouvrirAjoutStock()"><mat-icon>add</mat-icon> Ajouter du stock</button>
            <button class="btn-ghost" (click)="ouvrirEditionLegere()"><mat-icon>edit</mat-icon> Modifier</button>
            <button class="btn-ghost" (click)="reprendreScan()">Scanner autre</button>
          </div>

          <!-- Sous-panneau : ajout de stock -->
          <div class="sub-panel" *ngIf="modeAjoutStock">
            <div class="reappro-type-choice" *ngIf="(produitBoutiqueCible.prixGros || 0) > 0 && produitBoutiqueCible.modeStock !== 'lie'">
              <button class="reappro-type-btn" [class.active]="champStockCible === 'stock'" (click)="champStockCible = 'stock'">Détail</button>
              <button class="reappro-type-btn" [class.active]="champStockCible === 'stockGros'" (click)="champStockCible = 'stockGros'">Gros</button>
            </div>
            <div class="stock-row">
              <input class="idx-select" type="number" min="1" [(ngModel)]="quantiteAjout" placeholder="Quantité" />
              <button class="btn-primary" (click)="confirmerAjoutStock()" [disabled]="isLoading || !(quantiteAjout > 0)">Confirmer</button>
              <button class="btn-ghost" (click)="modeAjoutStock = false">Annuler</button>
            </div>
          </div>

          <!-- Sous-panneau : édition légère -->
          <div class="sub-panel" *ngIf="modeEdition">
            <div class="f-grp"><label>Nom</label><input class="idx-select" [(ngModel)]="editForm.nom" /></div>
            <div class="f-row">
              <div class="f-grp"><label>Prix détail</label><input class="idx-select" type="number" [(ngModel)]="editForm.prix" /></div>
              <div class="f-grp"><label>Prix gros</label><input class="idx-select" type="number" [(ngModel)]="editForm.prixGros" /></div>
            </div>
            <div class="f-grp">
              <label>Catégorie</label>
              <select class="idx-select" [(ngModel)]="editForm.categorie">
                <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
              </select>
            </div>
            <div class="stock-row">
              <button class="btn-primary" (click)="confirmerEditionLegere()" [disabled]="isLoading">Enregistrer</button>
              <button class="btn-ghost" (click)="modeEdition = false">Annuler</button>
            </div>
          </div>
        </div>

        <!-- Cas 2 : connu ailleurs (préremplissage) ou 3 : totalement inconnu -->
        <div class="result-card creation" *ngIf="resultat === 'connuAilleurs' || resultat === 'nouveau'">
          <div class="result-head">
            <mat-icon>{{ resultat === 'connuAilleurs' ? 'travel_explore' : 'new_releases' }}</mat-icon>
            <span>{{ resultat === 'connuAilleurs' ? ('Connu dans ' + nbBoutiques + ' autre(s) boutique(s)') : 'Code-barres totalement inconnu' }}</span>
          </div>
          <p class="idx-hint" *ngIf="resultat === 'connuAilleurs'">Champs préremplis — stock et péremption à saisir pour cette boutique.</p>
          <div class="f-grp"><label>Nom</label><input class="idx-select" [(ngModel)]="creationForm.nom" placeholder="Nom du produit" /></div>
          <div class="f-row">
            <div class="f-grp"><label>Prix détail</label><input class="idx-select" type="number" [(ngModel)]="creationForm.prix" /></div>
            <div class="f-grp"><label>Prix gros (optionnel)</label><input class="idx-select" type="number" [(ngModel)]="creationForm.prixGros" /></div>
          </div>
          <div class="f-grp">
            <label>Catégorie</label>
            <select class="idx-select" [(ngModel)]="creationForm.categorie">
              <option value="" disabled>Choisir…</option>
              <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
            </select>
          </div>
          <div class="f-row">
            <div class="f-grp"><label>Stock initial</label><input class="idx-select" type="number" min="0" [(ngModel)]="creationForm.stock" /></div>
            <div class="f-grp"><label>Seuil alerte</label><input class="idx-select" type="number" min="0" [(ngModel)]="creationForm.seuilAlerte" /></div>
          </div>
          <div class="f-grp"><label>Date de péremption (optionnel)</label><input class="idx-select" type="date" [(ngModel)]="creationForm.dateExpiration" /></div>
          <div class="stock-row">
            <button class="btn-primary" (click)="confirmerCreation()" [disabled]="isLoading || !creationForm.nom.trim() || !creationForm.categorie">
              <mat-icon>save</mat-icon> Créer pour {{ nomBoutiqueChoisie }}
            </button>
            <button class="btn-ghost" (click)="reprendreScan()">Annuler</button>
          </div>
        </div>

        <div class="session-count" *ngIf="produitsIndexesSession > 0">
          {{ produitsIndexesSession }} produit(s) indexé(s) durant cette session
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; height: 100dvh; overflow-y: auto; background: #0a1420; color: #e8eaf0; }
    .idx-page { max-width: 600px; margin: 0 auto; padding: 16px; }
    .idx-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .back-link { color: #8892a4; display: flex; }
    .idx-title { font-size: 17px; font-weight: 700; }
    .idx-sub { font-size: 12px; color: #4a5568; }

    .idx-label { display: block; font-size: 12px; color: #8892a4; margin-bottom: 6px; }
    .idx-select {
      width: 100%; padding: 10px 12px; background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: #e8eaf0;
      font-size: 14px; outline: none; box-sizing: border-box;
    }
    .idx-select:focus { border-color: #00b894; }
    .boutique-lock { display: flex; flex-direction: column; gap: 10px; max-width: 380px; margin: 40px auto; }

    .boutique-badge {
      display: flex; align-items: center; gap: 8px; background: rgba(0,184,148,.1);
      border: 1px solid rgba(0,184,148,.25); border-radius: 12px; padding: 10px 14px;
      margin-bottom: 14px; font-size: 13px; font-weight: 600; color: #00b894;
    }
    .boutique-badge mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .chg-boutique { margin-left: auto; background: transparent; border: none; color: #8892a4; font-size: 11px; text-decoration: underline; cursor: pointer; }

    .camera-card { background: #0f1b2d; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 14px; margin-bottom: 14px; }
    .video-wrapper { position: relative; width: 100%; aspect-ratio: 4/3; background: #000; border-radius: 12px; overflow: hidden; }
    .video-wrapper video { width: 100%; height: 100%; object-fit: cover; }
    .video-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #4a5568; background: #0a1420; }
    .video-placeholder mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .scan-frame { position: absolute; inset: 15% 10%; pointer-events: none; }
    .corner { position: absolute; width: 22px; height: 22px; border: 3px solid #00b894; }
    .corner.tl { top: 0; left: 0; border-right: none; border-bottom: none; }
    .corner.tr { top: 0; right: 0; border-left: none; border-bottom: none; }
    .corner.bl { bottom: 0; left: 0; border-right: none; border-top: none; }
    .corner.br { bottom: 0; right: 0; border-left: none; border-top: none; }
    .scan-line { position: absolute; left: 0; right: 0; top: 0; height: 2px; background: #00b894; animation: scanline 1.8s ease-in-out infinite; }
    @keyframes scanline { 0%,100% { top: 0; } 50% { top: 100%; } }
    .verif-overlay { position: absolute; inset: 0; background: rgba(10,20,32,.82); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #00b894; font-size: 13px; font-weight: 600; }
    .verif-spin { font-size: 26px; width: 26px; height: 26px; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .camera-actions { display: flex; gap: 8px; margin-top: 12px; }
    .camera-actions button { flex: 1; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600; }

    .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; background: #00b894; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-primary.w100 { width: 100%; }
    .btn-ghost { padding: 10px 16px; background: transparent; color: #8892a4; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; font-size: 13px; cursor: pointer; }
    .btn-primary mat-icon, .btn-ghost mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .manual-wrapper { display: flex; gap: 8px; margin-bottom: 14px; }
    .manual-wrapper .idx-select { flex: 1; }
    .idx-error { color: #e74c3c; font-size: 13px; text-align: center; margin: 8px 0; }

    .result-card { background: #0f1b2d; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 16px; margin-bottom: 14px; }
    .result-card.deja { border-color: rgba(253,203,110,.3); }
    .result-head { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 10px; }
    .result-card.deja .result-head { color: #fdcb6e; }
    .result-card.creation .result-head { color: #00b894; }
    .produit-nom { font-size: 15px; font-weight: 700; }
    .produit-meta { font-size: 12px; color: #8892a4; margin-top: 2px; }
    .idx-hint { font-size: 12px; color: #4a5568; margin: 0 0 10px; }
    .deja-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .deja-actions button { flex: 1; min-width: 100px; }

    .sub-panel { margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,.1); display: flex; flex-direction: column; gap: 10px; }
    .reappro-type-choice { display: flex; gap: 6px; }
    .reappro-type-btn { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: transparent; color: #8892a4; font-size: 12px; cursor: pointer; }
    .reappro-type-btn.active { background: rgba(0,184,148,.15); border-color: #00b894; color: #00b894; }
    .stock-row { display: flex; gap: 8px; }
    .stock-row .idx-select { flex: 1; }
    .stock-row button { flex: 1; }

    .f-grp { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
    .f-grp label { font-size: 11px; color: #8892a4; }
    .f-row { display: flex; gap: 10px; }
    .f-row .f-grp { flex: 1; }

    .session-count { text-align: center; color: #4a5568; font-size: 12px; margin-top: 10px; }
  `],
})
export class IndexationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  private readonly SK = 'ss_admin_key';
  private readonly base = environment.apiUrl.replace(/\/+$/, '').replace(/\/api$/, '') + '/api/admin';
  private adminKey = '';

  // Étape 1 — boutique cible verrouillée pour toute la session
  patrons: Patron[] = [];
  chargementPatrons = false;
  tenantIdChoisi = '';
  boutiqueVerrouillee = false;
  nomBoutiqueChoisie = '';

  categories = CATEGORIES;

  // Caméra — moteur identique à scan-ajout.component.ts (patron), voir ce
  // fichier pour l'explication complète de chaque bloc.
  cameraActive = false;
  cameraAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  facingMode: 'environment' | 'user' = 'environment';
  isStarting = false;
  isLoading = false;
  errorMessage = '';
  manualCode = '';
  dernierCode = '';

  resultat: EtatResultat = 'idle';
  produitBoutiqueCible: ProduitBoutiqueCible | null = null;
  nbBoutiques = 0;
  produitsIndexesSession = 0;

  modeAjoutStock = false;
  quantiteAjout = 1;
  champStockCible: 'stock' | 'stockGros' = 'stock';

  modeEdition = false;
  editForm = { nom: '', prix: 0, prixGros: 0, categorie: '' };

  creationForm = { nom: '', prix: 0, prixGros: 0, categorie: '', stock: 0, seuilAlerte: 5, dateExpiration: '' };

  private detector: BarcodeDetectorLike | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private zxingControls: IScannerControls | null = null;
  private mediaStream: MediaStream | null = null;
  private scanRafId: number | null = null;
  private lastDetectTs = 0;
  private isProcessingCameraCode = false;
  private candidatCode = '';
  private candidatCount = 0;
  private reouvertureAuto = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private zone: NgZone, private router: Router) {
    if (this.cameraSupported) {
      const DetectorClass = (window as any).BarcodeDetector;
      this.detector = new DetectorClass({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    } else {
      this.zxingReader = new BrowserMultiFormatReader(IndexationComponent.buildZxingHints());
    }
  }

  private static buildZxingHints(): Map<DecodeHintType, unknown> {
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
    ]);
    return hints;
  }

  private h(): HttpHeaders {
    return new HttpHeaders({ 'x-admin-key': this.adminKey });
  }

  ngOnInit(): void {
    // Réutilise la session admin déjà ouverte sur /admin (même clé, même
    // sessionStorage) — pas de re-connexion demandée. Si personne n'est
    // connecté (accès direct à l'URL), on renvoie vers la porte d'entrée
    // plutôt que de laisser tous les appels API échouer en 403 silencieux.
    this.adminKey = sessionStorage.getItem(this.SK) || '';
    if (!this.adminKey) { this.router.navigateByUrl('/admin'); return; }
    this.chargerPatrons();
  }

  ngAfterViewInit(): void {
    // La caméra ne démarre qu'une fois la boutique verrouillée (voir
    // verrouillerBoutique()) — pas de flux inutile pendant la sélection.
  }

  stockGrosAffiche(p: ProduitBoutiqueCible): number {
    if (p.modeStock === 'lie') return p.uniteParGros ? Math.floor((p.stock || 0) / p.uniteParGros) : 0;
    return p.stockGros || 0;
  }

  private chargerPatrons(): void {
    this.chargementPatrons = true;
    this.http.get<{ success: boolean; data: Patron[] }>(`${this.base}/users`, { headers: this.h() }).subscribe({
      next: (res) => this.zone.run(() => {
        this.chargementPatrons = false;
        this.patrons = (res?.data || []).filter((p) => p.actif);
        this.cdr.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        this.chargementPatrons = false;
        if (err?.status === 401 || err?.status === 403) { this.router.navigateByUrl('/admin'); return; }
        this.cdr.detectChanges();
      }),
    });
  }

  verrouillerBoutique(): void {
    const p = this.patrons.find((x) => x.tenantId === this.tenantIdChoisi);
    if (!p) return;
    this.nomBoutiqueChoisie = p.boutique || p.nom;
    this.boutiqueVerrouillee = true;
    this.cdr.detectChanges();
    requestAnimationFrame(() => this.demarrerScan());
  }

  changerBoutique(): void {
    this.stopCameraScan();
    this.boutiqueVerrouillee = false;
    this.resultat = 'idle';
    this.produitsIndexesSession = 0;
  }

  // ─── Caméra (identique à scan-ajout.component.ts) ──────────────────
  async demarrerScan(): Promise<void> {
    if (this.cameraActive || this.isStarting) return;
    this.errorMessage = '';
    await this.startCameraScan();
  }

  async startCameraScan(): Promise<void> {
    if (!this.videoRef?.nativeElement) { this.errorMessage = 'Élément vidéo non disponible'; return; }
    const video = this.videoRef.nativeElement;
    if (video.offsetWidth === 0 || video.offsetHeight === 0) await new Promise((r) => setTimeout(r, 100));

    this.isStarting = true;
    this.cdr.detectChanges();
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getCameraConstraints());
      video.srcObject = this.mediaStream;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Erreur chargement vidéo'));
        setTimeout(() => resolve(), 3000);
      });
      await video.play().catch((playErr: any) => { if (playErr?.name !== 'AbortError') throw playErr; });
      this.cameraActive = true;
      this.cdr.detectChanges();

      if (this.detector) {
        this.lastDetectTs = 0;
        const rafLoop = async (ts: number) => {
          if (!this.cameraActive || !this.detector) return;
          if (ts - this.lastDetectTs >= 150 && !this.isProcessingCameraCode) {
            this.lastDetectTs = ts;
            try {
              const results = await this.detector.detect(video);
              const code = results?.[0]?.rawValue?.trim();
              if (code) this.onCameraCodeDetected(code);
            } catch {}
          }
          this.scanRafId = requestAnimationFrame(rafLoop);
        };
        this.scanRafId = requestAnimationFrame(rafLoop);
      } else if (this.zxingReader) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        let stopLoop = false;
        this.zxingControls = { stop: () => { stopLoop = true; } } as any;
        const loop = () => {
          if (stopLoop || !this.cameraActive) return;
          try {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              const cropW = Math.round(video.videoWidth * 0.85);
              const cropH = Math.round(video.videoHeight * 0.45);
              const sx = Math.round((video.videoWidth - cropW) / 2);
              const sy = Math.round((video.videoHeight - cropH) / 2);
              canvas.width = cropW; canvas.height = cropH;
              ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
              const result = this.zxingReader!.decodeFromCanvas(canvas);
              if (result?.getText()) this.onCameraCodeDetected(result.getText());
            }
          } catch {}
          if (!stopLoop) setTimeout(loop, 80);
        };
        loop();
      }
    } catch (err: any) {
      this.errorMessage = err?.name === 'NotAllowedError'
        ? "Autorisez l'accès à la caméra dans les paramètres du navigateur"
        : err?.name === 'NotFoundError'
        ? 'Aucune caméra trouvée sur cet appareil'
        : 'Erreur caméra : ' + (err?.message || 'inconnue');
      this.cdr.detectChanges();
    } finally {
      this.isStarting = false;
      this.cdr.detectChanges();
    }
  }

  private getCameraConstraints(): MediaStreamConstraints {
    const surZxing = !this.detector;
    return {
      video: {
        facingMode: { ideal: this.facingMode },
        width: surZxing ? { min: 640, ideal: 1280, max: 1920 } : { min: 640, ideal: 1920, max: 3840 },
        height: surZxing ? { min: 480, ideal: 720, max: 1080 } : { min: 480, ideal: 1080, max: 2160 },
        // @ts-ignore focusMode pas encore dans le type standard
        advanced: [{ focusMode: 'continuous' }],
      } as MediaTrackConstraints,
    };
  }

  private onCameraCodeDetected(code: string): void {
    if (this.isProcessingCameraCode || this.resultat !== 'idle') return;
    if (!checksumEanValide(code)) { this.candidatCode = ''; this.candidatCount = 0; return; }
    if (code !== this.candidatCode) { this.candidatCode = code; this.candidatCount = 1; return; }
    this.candidatCount++;
    if (this.candidatCount < 2) return;
    this.candidatCode = ''; this.candidatCount = 0;
    this.isProcessingCameraCode = true;
    this.traiterCode(code);
    setTimeout(() => (this.isProcessingCameraCode = false), 1500);
  }

  async switchCamera(): Promise<void> {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (!this.cameraActive) return;
    this.stopCameraScan();
    await new Promise((r) => setTimeout(r, 200));
    await this.startCameraScan();
  }

  arreterManuellement(): void {
    this.reouvertureAuto = false;
    this.stopCameraScan();
  }

  stopCameraScan(): void {
    this.cameraActive = false;
    if (this.scanRafId !== null) { cancelAnimationFrame(this.scanRafId); this.scanRafId = null; }
    if (this.mediaStream) { this.mediaStream.getTracks().forEach((t) => t.stop()); this.mediaStream = null; }
    if (this.zxingReader) { this.zxingControls?.stop(); this.zxingControls = null; }
    if (this.videoRef?.nativeElement) this.videoRef.nativeElement.srcObject = null;
    this.cdr.detectChanges();
  }

  // Coupe la caméra pendant qu'un modal de décision est affiché (déjà là /
  // connu ailleurs / nouveau) — évite de faire tourner le stream + la
  // boucle de décodage pour rien pendant que l'admin remplit un formulaire,
  // qui chauffait l'appareil sans raison (constat direct sur le terrain).
  private couperCameraPourTraitement(): void {
    if (this.cameraActive) { this.reouvertureAuto = true; this.stopCameraScan(); }
  }

  reprendreScan(): void {
    this.resultat = 'idle';
    this.produitBoutiqueCible = null;
    this.dernierCode = '';
    this.errorMessage = '';
    this.candidatCode = ''; this.candidatCount = 0;
    this.modeAjoutStock = false; this.modeEdition = false;
    this.quantiteAjout = 1; this.champStockCible = 'stock';
    if (this.reouvertureAuto) { this.reouvertureAuto = false; this.startCameraScan(); }
  }

  // ─── Traitement du code (lookup admin cross-tenant + boutique cible) ──
  traiterCode(code: string): void {
    const c = (code || '').trim();
    if (!c || this.isLoading || !this.tenantIdChoisi) return;
    this.errorMessage = '';
    this.dernierCode = c;
    this.isLoading = true;

    this.http.get<any>(
      `${this.base}/produits/lookup/${encodeURIComponent(c)}?tenantId=${encodeURIComponent(this.tenantIdChoisi)}`,
      { headers: this.h() },
    ).subscribe({
      next: (res) => this.zone.run(() => {
        this.isLoading = false;
        this.manualCode = '';
        if (res?.dejaDansBoutiqueCible && res?.produitBoutiqueCible) {
          this.produitBoutiqueCible = res.produitBoutiqueCible;
          this.champStockCible = 'stock';
          this.resultat = 'dejaLa';
          this.couperCameraPourTraitement();
        } else if (res?.trouve && res?.data) {
          this.nbBoutiques = res.nbBoutiques || 1;
          this.creationForm = {
            nom: res.data.nom || '', prix: res.data.prix || 0, prixGros: res.data.prixGros || 0,
            categorie: res.data.categorie || '', stock: 0, seuilAlerte: 5, dateExpiration: '',
          };
          this.resultat = 'connuAilleurs';
          this.couperCameraPourTraitement();
        } else {
          this.creationForm = { nom: '', prix: 0, prixGros: 0, categorie: '', stock: 0, seuilAlerte: 5, dateExpiration: '' };
          this.resultat = 'nouveau';
          this.couperCameraPourTraitement();
        }
        this.cdr.detectChanges();
      }),
      error: () => this.zone.run(() => {
        this.isLoading = false;
        this.manualCode = '';
        this.errorMessage = 'Erreur réseau, réessayez';
        this.cdr.detectChanges();
      }),
    });
  }

  // ─── Actions : produit déjà dans la boutique cible ─────────────────
  ouvrirAjoutStock(): void { this.modeAjoutStock = true; this.quantiteAjout = 1; }

  confirmerAjoutStock(): void {
    if (!this.produitBoutiqueCible?._id || !(this.quantiteAjout > 0)) return;
    this.isLoading = true;
    this.http.patch<any>(
      `${this.base}/produits/${this.produitBoutiqueCible._id}/stock`,
      { champ: this.champStockCible, quantite: this.quantiteAjout },
      { headers: this.h() },
    ).subscribe({
      next: (res) => this.zone.run(() => {
        this.isLoading = false;
        if (res?.success) { this.produitsIndexesSession++; this.reprendreScan(); }
        else this.errorMessage = res?.message || 'Erreur';
        this.cdr.detectChanges();
      }),
      error: () => this.zone.run(() => { this.isLoading = false; this.errorMessage = 'Erreur réseau'; this.cdr.detectChanges(); }),
    });
  }

  ouvrirEditionLegere(): void {
    if (!this.produitBoutiqueCible) return;
    this.editForm = {
      nom: this.produitBoutiqueCible.nom,
      prix: this.produitBoutiqueCible.prix,
      prixGros: this.produitBoutiqueCible.prixGros || 0,
      categorie: this.produitBoutiqueCible.categorie,
    };
    this.modeEdition = true;
  }

  confirmerEditionLegere(): void {
    if (!this.produitBoutiqueCible?._id) return;
    this.isLoading = true;
    this.http.patch<any>(
      `${this.base}/produits/${this.produitBoutiqueCible._id}`,
      this.editForm,
      { headers: this.h() },
    ).subscribe({
      next: (res) => this.zone.run(() => {
        this.isLoading = false;
        if (res?.success) { this.produitsIndexesSession++; this.reprendreScan(); }
        else this.errorMessage = res?.message || 'Erreur';
        this.cdr.detectChanges();
      }),
      error: () => this.zone.run(() => { this.isLoading = false; this.errorMessage = 'Erreur réseau'; this.cdr.detectChanges(); }),
    });
  }

  // ─── Action : création pour la boutique cible ───────────────────────
  confirmerCreation(): void {
    if (!this.creationForm.nom.trim() || !this.creationForm.categorie) return;
    this.isLoading = true;
    const body: any = {
      tenantId: this.tenantIdChoisi,
      codeBarres: this.dernierCode,
      nom: this.creationForm.nom.trim(),
      prix: this.creationForm.prix || 0,
      categorie: this.creationForm.categorie,
      stock: this.creationForm.stock || 0,
      seuilAlerte: this.creationForm.seuilAlerte || 5,
    };
    if (this.creationForm.prixGros > 0) body.prixGros = this.creationForm.prixGros;
    if (this.creationForm.dateExpiration) body.dateExpiration = this.creationForm.dateExpiration;

    this.http.post<any>(`${this.base}/produits`, body, { headers: this.h() }).subscribe({
      next: (res) => this.zone.run(() => {
        this.isLoading = false;
        if (res?.success) { this.produitsIndexesSession++; this.reprendreScan(); }
        else this.errorMessage = res?.message || 'Erreur création';
        this.cdr.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Erreur réseau';
        this.cdr.detectChanges();
      }),
    });
  }

  ngOnDestroy(): void { this.stopCameraScan(); }
}
