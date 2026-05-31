import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PosService } from '../services/pos.service';
import { OfflineService, CachedProduit } from '../../../core/services/offline.service';
import { AuthService } from '../../../core/services/auth.service';
import { SyncService } from '../../../core/services/sync.service';

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  template: `
    <div class="page-container">
      <div class="scan-header">
        <div class="scan-title">Scanner Produit</div>
        <div class="scan-sub">Caméra ou saisie par nom / code-barres</div>
      </div>

      <!-- Caméra -->
      <div class="camera-card">
        <div class="camera-head">
          <mat-icon>photo_camera</mat-icon>
          <strong>Scan caméra</strong>
        </div>

        <div class="video-wrapper">
          <div class="video-placeholder" *ngIf="!cameraActive">
            <mat-icon>photo_camera</mat-icon>
            <span>Appuyez sur Démarrer</span>
          </div>
          <video #video autoplay muted playsinline [class.hidden]="!cameraActive"></video>
          <div class="scan-frame" *ngIf="cameraActive">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
          </div>
        </div>

        <div class="camera-actions">
          <button
            (click)="demarrerScan()"
            [disabled]="cameraActive || isStarting || !cameraAvailable"
          >
            {{ isStarting ? 'Démarrage...' : 'Démarrer caméra' }}
          </button>
          <button class="secondary" (click)="switchCamera()" [disabled]="!cameraActive">
            Basculer caméra
          </button>
          <button class="secondary" (click)="stopCameraScan()" [disabled]="!cameraActive">
            Arrêter
          </button>
        </div>
        <p class="hint" *ngIf="!cameraSupported">
          BarcodeDetector non supporté: fallback ZXing activé.
        </p>
      </div>

      <!-- Recherche manuelle avec autocomplétion -->
      <div class="search-wrapper">
        <div class="scan-form">
          <input
            type="text"
            [(ngModel)]="barcode"
            (ngModelChange)="onInputChange($event)"
            (keyup.enter)="scanProduct()"
            placeholder="Nom produit ou code-barres..."
            [disabled]="isLoading"
            autocomplete="off"
          />
          <button (click)="scanProduct()" [disabled]="isLoading || !barcode.trim()">
            {{ isLoading ? '...' : 'Ajouter' }}
          </button>
        </div>

        <!-- Suggestions -->
        <div class="suggestions" *ngIf="suggestions.length > 0">
          <div
            class="suggestion-item"
            *ngFor="let p of suggestions"
            (click)="selectionnerProduit(p)"
          >
            <div class="sug-info">
              <span class="sug-nom">{{ p.nom }}</span>
              <span class="sug-code" *ngIf="p.codeBarres">{{ p.codeBarres }}</span>
            </div>
            <div class="sug-right">
              <span class="sug-prix">{{ p.prix | number: '1.0-0' }} FCFA</span>
              <span class="sug-stock" [class.bas]="p.stock <= (p.seuilAlerte || 5)">
                Stock: {{ p.stock }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p class="success" *ngIf="lastProductName">✅ Ajouté: {{ lastProductName }}</p>
      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

      <a routerLink="/agent/panier" class="panier-link">
        <mat-icon>shopping_cart</mat-icon>
        Aller au panier
        <span class="cart-count" *ngIf="cartCount > 0">{{ cartCount }}</span>
      </a>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 600px;
        margin: 0 auto;
      }

      /* Header */
      .scan-header {
        margin-bottom: 16px;
      }
      .scan-title {
        color: var(--text-1);
        font-size: 22px;
        font-weight: 700;
      }
      .scan-sub {
        color: var(--text-3);
        font-size: 13px;
        margin-top: 4px;
      }

      /* Camera card */
      .camera-card {
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 16px;
        padding: 12px;
        margin-bottom: 12px;
        position: relative;
        backdrop-filter: blur(12px);
      }
      .camera-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        color: var(--text-2);
        font-size: 14px;
        font-weight: 600;
      }
      .camera-head mat-icon {
        color: var(--accent);
        font-size: 20px;
      }

      /* Video wrapper pour contenir le scan-frame */
      .video-wrapper {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        background: #060e1a;
        min-height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .video-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--text-3);
        font-size: 12px;
      }
      .video-placeholder mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--text-3);
      }

      video {
        width: 100%;
        max-height: 240px;
        border-radius: 10px;
        background: #060e1a;
        object-fit: cover;
        display: block;
      }
      video.hidden {
        display: none;
      }

      /* Scan frame — relatif au video-wrapper */
      .scan-frame {
        position: absolute;
        inset: 8px;
        pointer-events: none;
      }
      .corner {
        position: absolute;
        width: 24px;
        height: 24px;
        border: 2.5px solid var(--accent);
      }
      .corner.tl {
        top: 0;
        left: 0;
        border-right: 0;
        border-bottom: 0;
        border-radius: 4px 0 0 0;
      }
      .corner.tr {
        top: 0;
        right: 0;
        border-left: 0;
        border-bottom: 0;
        border-radius: 0 4px 0 0;
      }
      .corner.bl {
        bottom: 0;
        left: 0;
        border-right: 0;
        border-top: 0;
        border-radius: 0 0 0 4px;
      }
      .corner.br {
        bottom: 0;
        right: 0;
        border-left: 0;
        border-top: 0;
        border-radius: 0 0 4px 0;
      }

      /* Camera buttons */
      .camera-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .camera-actions button {
        flex: 1;
        padding: 10px 8px;
        border-radius: 10px;
        border: none;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        min-width: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .camera-actions button:first-child {
        background: var(--accent);
        color: #fff;
      }
      .camera-actions button:first-child:disabled {
        background: var(--accent-lite);
        color: var(--accent);
        opacity: 0.7;
      }
      .camera-actions button.secondary {
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid var(--navy-border);
        color: var(--text-2);
      }
      .camera-actions button.secondary:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .hint {
        color: var(--text-3);
        font-size: 11px;
        margin-top: 8px;
      }

      /* Search */
      .search-wrapper {
        position: relative;
        margin: 12px 0;
      }
      .scan-form {
        display: flex;
        gap: 8px;
      }
      input {
        flex: 1;
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 12px;
        padding: 12px 14px;
        color: var(--text-1);
        font-size: 14px;
        outline: none;
        backdrop-filter: blur(12px);
      }
      input::placeholder {
        color: var(--text-3);
      }
      input:focus {
        border-color: var(--accent);
      }

      .scan-form button {
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 12px 18px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .scan-form button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Suggestions */
      .suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 60px;
        background: #162236;
        border: 1px solid var(--navy-border);
        border-radius: 0 0 12px 12px;
        z-index: 100;
        max-height: 240px;
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      .suggestion-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid var(--navy-border);
        transition: background 0.15s;
      }
      .suggestion-item:hover {
        background: var(--accent-lite);
      }
      .suggestion-item:last-child {
        border-bottom: none;
      }
      .sug-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sug-nom {
        color: var(--text-1);
        font-size: 13px;
        font-weight: 600;
      }
      .sug-code {
        color: var(--text-3);
        font-size: 10px;
        font-family: monospace;
      }
      .sug-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .sug-prix {
        color: var(--accent);
        font-size: 13px;
        font-weight: 700;
      }
      .sug-stock {
        color: var(--text-3);
        font-size: 10px;
      }
      .sug-stock.bas {
        color: var(--danger);
        font-weight: 600;
      }

      /* Messages */
      .success {
        color: var(--accent);
        font-size: 13px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .error {
        color: var(--danger);
        font-size: 13px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Panier link */
      .panier-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 16px;
        color: var(--accent);
        font-size: 14px;
        font-weight: 600;
      }
      .cart-count {
        background: var(--danger);
        color: #fff;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class ScanComponent implements OnInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  barcode = '';
  isLoading = false;
  errorMessage = '';
  lastProductName = '';
  cameraActive = false;
  cameraAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  facingMode: 'environment' | 'user' = 'environment';
  suggestions: CachedProduit[] = [];
  allProduits: CachedProduit[] = [];
  cartCount = 0;
  isStarting = false;

  private detector: BarcodeDetectorLike | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private zxingControls: IScannerControls | null = null;
  private mediaStream: MediaStream | null = null;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessingCameraCode = false;
  private destroy$ = new Subject<void>();

  constructor(
    private pos: PosService,
    private offline: OfflineService,
    private auth: AuthService,
    private sync: SyncService,
  ) {
    if (this.cameraSupported) {
      const DetectorClass = (window as any).BarcodeDetector;
      this.detector = new DetectorClass({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
      });
    } else {
      this.zxingReader = new BrowserMultiFormatReader();
    }
  }

  async ngOnInit(): Promise<void> {
    const tenantId = this.auth.getTenantId() ?? '';

    // 1. Cache local d'abord
    this.allProduits = await this.offline.getProduits(tenantId);

    // 2. Si cache vide ET en ligne → charger depuis l'API
    if (this.allProduits.length === 0 && this.sync.estEnLigne()) {
      try {
        const token = localStorage.getItem('token') ?? '';
        const res: any = await fetch('https://smartstock-api-1zzc.onrender.com/api/produits', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());

        if (res?.success && res?.data) {
          const produits = res.data.map((p: any) => ({ ...p, tenantId }));
          await this.offline.cacheProduits(tenantId, produits);
          this.allProduits = produits;
        }
      } catch {
        // silencieux si hors ligne
      }
    }

    // 3. Suivre le panier
    this.pos.cart$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      this.cartCount = items.reduce((s, i) => s + i.quantite, 0);
    });
  }

  // ─── Autocomplétion ────────────────────────────────────────

  onInputChange(value: string): void {
    const q = value.trim().toLowerCase();
    if (q.length < 2) {
      this.suggestions = [];
      return;
    }
    this.suggestions = this.allProduits
      .filter(
        (p) =>
          p.nom.toLowerCase().includes(q) ||
          (p.codeBarres && p.codeBarres.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }

  selectionnerProduit(produit: CachedProduit): void {
    this.suggestions = [];
    this.barcode = '';
    this.errorMessage = '';
    this.pos.addToCart(produit);
    this.lastProductName = produit.nom;
    this.playSuccessSound();
    setTimeout(() => (this.lastProductName = ''), 2000);
  }

  // ─── Scan par code-barres ───────────────────────────────────

  async scanProduct(): Promise<void> {
    const code = this.barcode.trim();
    if (!code) return;
    this.suggestions = [];
    this.errorMessage = '';
    this.lastProductName = '';
    this.isLoading = true;

    // 1. Chercher dans le cache local d'abord
    const fromCache =
      (await this.offline.getProduitByBarcode(code)) ||
      this.allProduits.find((p) => p.nom.toLowerCase() === code.toLowerCase());

    if (fromCache) {
      this.pos.addToCart(fromCache);
      this.lastProductName = fromCache.nom;
      this.playSuccessSound();
      this.barcode = '';
      this.isLoading = false;
      setTimeout(() => (this.lastProductName = ''), 2000);
      return;
    }

    // 2. Si en ligne → appel API
    if (this.sync.estEnLigne()) {
      this.pos
        .searchByBarcode(code)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (produit) => {
            this.pos.addToCart(produit);
            this.lastProductName = produit?.nom || 'Produit';
            this.playSuccessSound();
            this.barcode = '';
            this.isLoading = false;
            setTimeout(() => (this.lastProductName = ''), 2000);
          },
          error: () => {
            this.errorMessage = 'Produit non trouvé';
            this.isLoading = false;
          },
        });
    } else {
      this.errorMessage = '📵 Produit non trouvé dans le cache hors ligne';
      this.isLoading = false;
    }
  }

  // ─── Caméra ─────────────────────────────────────────────────

  async demarrerScan(): Promise<void> {
    if (this.cameraActive) return;
    this.errorMessage = '';
    await this.startCameraScan();
  }

  async startCameraScan(): Promise<void> {
    if (!this.videoRef?.nativeElement) return;

    this.isStarting = true;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getCameraConstraints());
      const video = this.videoRef.nativeElement;
      video.srcObject = this.mediaStream;

      // Attendre que la vidéo soit prête avant de marquer actif
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
      this.cameraActive = true;

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
            this.errorMessage = 'Erreur de lecture caméra';
          }
        });
      }
    } catch {
      this.errorMessage = "Autorisez l'accès à la caméra dans les paramètres du navigateur";
    } finally {
      this.isStarting = false;
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
    if (this.isProcessingCameraCode) return;
    this.isProcessingCameraCode = true;
    this.barcode = code;
    this.scanProduct();
    setTimeout(() => (this.isProcessingCameraCode = false), 1500);
  }

  async switchCamera(): Promise<void> {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (!this.cameraActive) return;
    this.stopCameraScan();
    await this.startCameraScan();
  }

  stopCameraScan(): void {
    this.cameraActive = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.zxingReader) {
      this.zxingControls?.stop();
      this.zxingControls = null;
    }
    if (this.videoRef?.nativeElement) this.videoRef.nativeElement.srcObject = null;
  }

  private playSuccessSound(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  ngOnDestroy(): void {
    this.stopCameraScan();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
