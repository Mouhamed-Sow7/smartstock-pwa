import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { ProduitDialogComponent } from '../produit-dialog.component';
import { ProduitService, Produit } from '../produit.service';

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

type EtatResultat = 'idle' | 'trouve' | 'nouveau';

@Component({
  selector: 'app-scan-ajout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="scan-header">
        <a routerLink="/patron/produits" class="back-link">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div>
          <div class="scan-title">Scanner pour indexer</div>
          <div class="scan-sub">Etiquette deja imprimee sur le produit</div>
        </div>
      </div>

      <!-- Camera -->
      <div class="camera-card">
        <div class="video-wrapper">
          <!--
            La video est TOUJOURS dans le DOM avec dimensions fixes.
            Le navigateur ne peut pas streamer vers un element invisible/sans hauteur.
            On superpose le placeholder PAR-DESSUS en position absolute.
          -->
          <video #video muted playsinline></video>

          <!-- Placeholder superpose, retire des que la camera est active -->
          <div class="video-placeholder" *ngIf="!cameraActive">
            <mat-icon>{{ isStarting ? 'hourglass_empty' : 'photo_camera' }}</mat-icon>
            <span>{{ isStarting ? 'Demarrage...' : 'Appuyez sur Demarrer' }}</span>
          </div>

          <!-- Cadre de scan -->
          <div class="scan-frame" *ngIf="cameraActive">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
            <div class="scan-line"></div>
          </div>

          <!-- Overlay resultat -->
          <div class="pause-overlay" *ngIf="resultat !== 'idle'">
            <mat-icon>{{ resultat === 'trouve' ? 'check_circle' : 'new_releases' }}</mat-icon>
          </div>
        </div>

        <div class="camera-actions">
          <button
            (click)="demarrerScan()"
            [disabled]="cameraActive || isStarting || !cameraAvailable"
          >
            {{ cameraActive ? 'Camera active' : isStarting ? 'Demarrage...' : 'Demarrer' }}
          </button>
          <button class="secondary" (click)="switchCamera()" [disabled]="!cameraActive">
            Basculer
          </button>
          <button class="secondary" (click)="stopCameraScan()" [disabled]="!cameraActive">
            Arreter
          </button>
        </div>
      </div>

      <!-- Saisie manuelle -->
      <div class="manual-wrapper">
        <input
          type="text"
          [(ngModel)]="manualCode"
          (keyup.enter)="traiterCode(manualCode)"
          placeholder="Ou saisir le code-barres manuellement..."
          autocomplete="off"
        />
        <button (click)="traiterCode(manualCode)" [disabled]="!manualCode.trim() || isLoading">
          Verifier
        </button>
      </div>

      <!-- Resultat : produit deja existant -->
      <div class="result-card found" *ngIf="resultat === 'trouve' && produitTrouve">
        <div class="result-head">
          <mat-icon>check_circle</mat-icon>
          <span>Code deja associe</span>
        </div>
        <div class="produit-info">
          <div class="produit-nom">{{ produitTrouve.nom }}</div>
          <div class="produit-meta">
            {{ produitTrouve.prix | number: '1.0-0' }} FCFA &middot; Stock actuel :
            {{ produitTrouve.stock }}
          </div>
        </div>
        <div class="stock-entry">
          <label>Quantite recue (reassort)</label>
          <div class="stock-row">
            <input type="number" min="1" [(ngModel)]="quantiteEntree" />
            <button class="primary" (click)="confirmerEntreeStock()" [disabled]="isLoading">
              + Ajouter au stock
            </button>
          </div>
        </div>
        <div class="result-actions">
          <button class="secondary" (click)="ouvrirEdition()">Modifier</button>
          <button class="secondary" (click)="reprendreScan()">Scanner autre</button>
        </div>
      </div>

      <!-- Resultat : code inconnu -->
      <div class="result-card new" *ngIf="resultat === 'nouveau'">
        <div class="result-head">
          <mat-icon>new_releases</mat-icon>
          <span>Code-barres inconnu</span>
        </div>
        <p>{{ dernierCode }}</p>
        <p class="hint">Ce produit n'existe pas encore dans votre catalogue.</p>
        <div class="result-actions">
          <button class="primary" (click)="ouvrirCreation()">Creer le produit</button>
          <button class="secondary" (click)="reprendreScan()">Annuler</button>
        </div>
      </div>

      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

      <div class="session-count" *ngIf="produitsIndexesSession > 0">
        {{ produitsIndexesSession }} produit(s) indexes durant cette session
      </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 600px;
        margin: 0 auto;
      }
      .scan-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .back-link {
        display: flex;
        color: var(--text-2);
        text-decoration: none;
      }
      .scan-title {
        color: var(--text-1);
        font-size: 20px;
        font-weight: 700;
      }
      .scan-sub {
        color: var(--text-3);
        font-size: 13px;
        margin-top: 2px;
      }
      .camera-card {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 16px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .video-wrapper {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        background: #060e1a;
        /* Hauteur fixe obligatoire — le stream ne peut pas aller vers 0px */
        height: 240px;
      }
      video {
        /* Toujours pleine taille, toujours visible */
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .video-placeholder {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: var(--text-3);
        font-size: 12px;
        background: #060e1a;
        z-index: 2;
      }
      .video-placeholder mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }
      .scan-frame {
        position: absolute;
        inset: 12px;
        pointer-events: none;
        z-index: 3;
      }
      .corner {
        position: absolute;
        width: 24px;
        height: 24px;
        border: 2.5px solid var(--accent);
      }
      .corner.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-radius: 4px 0 0 0; }
      .corner.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-radius: 0 4px 0 0; }
      .corner.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-radius: 0 0 0 4px; }
      .corner.br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-radius: 0 0 4px 0; }
      .scan-line {
        position: absolute;
        left: 4px;
        right: 4px;
        height: 2px;
        background: var(--accent);
        opacity: 0.7;
        top: 50%;
        animation: scanMove 2s ease-in-out infinite;
      }
      @keyframes scanMove {
        0%, 100% { top: 10%; }
        50% { top: 90%; }
      }
      .pause-overlay {
        position: absolute;
        inset: 0;
        background: rgba(15, 27, 45, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 4;
      }
      .pause-overlay mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--accent);
      }
      .camera-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }
      .camera-actions button {
        flex: 1;
        padding: 10px 8px;
        border-radius: 10px;
        border: none;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        background: var(--accent);
        color: #04241c;
      }
      .camera-actions button.secondary {
        background: var(--navy-light);
        color: var(--text-2);
        border: 1px solid var(--navy-border);
      }
      .camera-actions button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .manual-wrapper {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .manual-wrapper input {
        flex: 1;
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 10px;
        padding: 12px;
        color: var(--text-1);
        font-size: 14px;
      }
      .manual-wrapper input::placeholder { color: var(--text-3); }
      .manual-wrapper button {
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid var(--navy-border);
        background: var(--navy-light);
        color: var(--text-2);
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
      }
      .manual-wrapper button:disabled { opacity: 0.4; }
      .result-card {
        border-radius: 16px;
        padding: 16px;
        margin-bottom: 12px;
        border: 1px solid var(--navy-border);
      }
      .result-card.found { background: var(--accent-lite); border-color: rgba(0,184,148,.3); }
      .result-card.new { background: rgba(243,156,18,.1); border-color: rgba(243,156,18,.3); }
      .result-head { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 10px; color: var(--text-1); }
      .result-card.found .result-head mat-icon { color: var(--accent); }
      .result-card.new .result-head mat-icon { color: var(--warning); }
      .produit-nom { font-size: 16px; font-weight: 700; color: var(--text-1); }
      .produit-meta { font-size: 13px; color: var(--text-2); margin-top: 2px; }
      .stock-entry { margin-top: 14px; }
      .stock-entry label { font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px; }
      .stock-row { display: flex; gap: 8px; }
      .stock-row input { width: 90px; background: var(--navy); border: 1px solid var(--navy-border); border-radius: 8px; padding: 10px; color: var(--text-1); font-size: 14px; }
      .result-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
      .result-actions button, .stock-row button { flex: 1; padding: 10px; border-radius: 10px; border: none; font-weight: 600; font-size: 13px; cursor: pointer; min-width: 100px; }
      button.primary { background: var(--accent); color: #04241c; }
      button.secondary { background: var(--navy-light); color: var(--text-2); border: 1px solid var(--navy-border); }
      .result-card.new p { color: var(--text-1); font-weight: 600; font-size: 15px; margin: 0 0 4px; }
      .result-card.new p.hint { color: var(--text-2); font-weight: 400; font-size: 13px; }
      .error { color: var(--danger); font-size: 13px; text-align: center; margin-top: 8px; }
      .session-count { text-align: center; color: var(--text-3); font-size: 12px; margin-top: 16px; }
    `,
  ],
})
export class ScanAjoutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

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
  produitTrouve: Produit | null = null;
  quantiteEntree = 1;
  produitsIndexesSession = 0;

  private detector: BarcodeDetectorLike | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private zxingControls: IScannerControls | null = null;
  private mediaStream: MediaStream | null = null;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessingCameraCode = false;

  constructor(
    private produitService: ProduitService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {
    if (this.cameraSupported) {
      const DetectorClass = (window as any).BarcodeDetector;
      this.detector = new DetectorClass({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
      });
    } else {
      this.zxingReader = new BrowserMultiFormatReader();
    }
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // ViewChild garanti ici. On demarre la camera automatiquement.
    // Sur iOS/Chrome, getUserMedia necessite que la page soit visible et chargee.
    // requestAnimationFrame garantit qu'on est apres le premier paint.
    requestAnimationFrame(() => {
      this.demarrerScan();
    });
  }

  // Camera

  async demarrerScan(): Promise<void> {
    if (this.cameraActive || this.isStarting) return;
    this.errorMessage = '';
    await this.startCameraScan();
  }

  async startCameraScan(): Promise<void> {
    // Double-check que l'element video existe bien dans le DOM et a des dimensions
    if (!this.videoRef?.nativeElement) {
      this.errorMessage = 'Element video non disponible';
      return;
    }

    const video = this.videoRef.nativeElement;

    // S'assurer que l'element a des dimensions (requis pour le stream)
    if (video.offsetWidth === 0 || video.offsetHeight === 0) {
      // Attendre le prochain frame si l'element n'a pas encore de dimensions
      await new Promise(r => setTimeout(r, 100));
    }

    this.isStarting = true;
    this.cdr.detectChanges();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getCameraConstraints());
      video.srcObject = this.mediaStream;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Erreur chargement video'));
        setTimeout(() => resolve(), 3000); // timeout securite
      });

      await video.play().catch((playErr: any) => {
        // AbortError bénigne (play() interrompu par un nouveau load) — on continue,
        // le flux est déjà attaché via srcObject et jouera de toute façon.
        if (playErr?.name !== 'AbortError') throw playErr;
      });
      this.cameraActive = true;
      this.cdr.detectChanges();

      if (this.detector) {
        this.scanInterval = setInterval(async () => {
          if (!this.detector || this.isProcessingCameraCode || !this.cameraActive) return;
          try {
            const results = await this.detector.detect(video);
            const code = results?.[0]?.rawValue?.trim();
            if (code) this.onCameraCodeDetected(code);
          } catch {}
        }, 450);
      } else if (this.zxingReader) {
        this.zxingControls = await this.zxingReader.decodeFromVideoElement(video, (result, err) => {
          if (result) {
            this.onCameraCodeDetected(result.getText());
            return;
          }
          const message = String((err as any)?.message || '');
          if (err && !message.toLowerCase().includes('notfoundexception')) {
            // Ne pas afficher l'erreur "NotFoundException" qui est normale (pas de code dans le champ)
          }
        });
      }
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Autorisez l\'acces a la camera dans les parametres du navigateur'
        : err?.name === 'NotFoundError'
        ? 'Aucune camera trouvee sur cet appareil'
        : 'Erreur camera : ' + (err?.message || 'inconnue');
      this.errorMessage = msg;
      this.cdr.detectChanges();
    } finally {
      this.isStarting = false;
      this.cdr.detectChanges();
    }
  }

  private getCameraConstraints(): MediaStreamConstraints {
    return {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };
  }

  private onCameraCodeDetected(code: string): void {
    if (this.isProcessingCameraCode || this.resultat !== 'idle') return;
    this.isProcessingCameraCode = true;
    this.traiterCode(code);
    setTimeout(() => (this.isProcessingCameraCode = false), 1500);
  }

  async switchCamera(): Promise<void> {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (!this.cameraActive) return;
    this.stopCameraScan();
    await new Promise(r => setTimeout(r, 200));
    await this.startCameraScan();
  }

  stopCameraScan(): void {
    this.cameraActive = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.zxingReader) {
      this.zxingControls?.stop();
      this.zxingControls = null;
    }
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
    this.cdr.detectChanges();
  }

  // Traitement du code

  traiterCode(code: string): void {
    const c = (code || '').trim();
    if (!c || this.isLoading) return;
    this.errorMessage = '';
    this.dernierCode = c;
    this.isLoading = true;

    this.produitService.getByBarcode(c).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res?.success && res?.data) {
          this.produitTrouve = res.data;
          this.quantiteEntree = 1;
          this.resultat = 'trouve';
          this.playSound(880);
        } else {
          this.afficherNouveau();
        }
        this.manualCode = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        if (err?.status === 404) {
          this.afficherNouveau();
        } else {
          this.errorMessage = 'Erreur reseau, reessayez';
        }
        this.manualCode = '';
        this.cdr.detectChanges();
      },
    });
  }

  private afficherNouveau(): void {
    this.produitTrouve = null;
    this.resultat = 'nouveau';
    this.playSound(440);
  }

  reprendreScan(): void {
    this.resultat = 'idle';
    this.produitTrouve = null;
    this.dernierCode = '';
    this.errorMessage = '';
  }

  confirmerEntreeStock(): void {
    if (!this.produitTrouve?._id || this.quantiteEntree <= 0) return;
    this.isLoading = true;
    this.produitService.updateStock(this.produitTrouve._id, this.quantiteEntree, 'entree').subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res?.success) {
          this.snackBar.open(`Stock mis a jour : ${res.data.stock} unites`, 'Fermer', { duration: 2500 });
          this.produitsIndexesSession++;
          this.reprendreScan();
        } else {
          this.errorMessage = res?.message || 'Erreur mise a jour stock';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Erreur reseau';
        this.cdr.detectChanges();
      },
    });
  }

  ouvrirEdition(): void {
    if (!this.produitTrouve) return;
    this.dialog.open(ProduitDialogComponent, {
      width: '500px',
      data: { produit: this.produitTrouve, isEdit: true },
    }).afterClosed().subscribe(result => {
      if (result) this.produitsIndexesSession++;
      this.reprendreScan();
    });
  }

  ouvrirCreation(): void {
    this.dialog.open(ProduitDialogComponent, {
      width: '500px',
      data: { produit: { codeBarres: this.dernierCode } as Produit, isEdit: false },
    }).afterClosed().subscribe(result => {
      if (result) this.produitsIndexesSession++;
      this.reprendreScan();
    });
  }

  private playSound(freq: number): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  ngOnDestroy(): void {
    this.stopCameraScan();
  }
}
