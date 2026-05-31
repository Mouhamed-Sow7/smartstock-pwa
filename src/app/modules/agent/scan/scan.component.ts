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
      <h1>Scanner Produit</h1>
      <p>Scannez via caméra ou saisissez le nom ou code-barres.</p>

      <!-- Caméra -->
      <div class="camera-card">
        <div class="camera-head">
          <mat-icon>photo_camera</mat-icon>
          <strong>Scan caméra</strong>
        </div>
        <video #video autoplay muted playsinline [class.hidden]="!cameraActive"></video>
        <div class="scan-frame" *ngIf="cameraActive">
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
        </div>
        <div class="camera-actions">
          <button (click)="demarrerScan()" [disabled]="cameraActive || !cameraAvailable">
            Démarrer caméra
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
        max-width: 860px;
        margin: 0 auto;
        padding: 16px;
      }
      .camera-card {
        background: #fff;
        border: 1px solid #e9ecef;
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 12px;
        position: relative;
      }
      .camera-head {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        color: #1a1a2e;
      }
      video {
        width: 100%;
        max-height: 280px;
        border-radius: 8px;
        background: #000;
        object-fit: cover;
      }
      video.hidden {
        display: none;
      }
      .camera-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .scan-frame {
        position: absolute;
        top: 56px;
        left: 24px;
        right: 24px;
        bottom: 64px;
        pointer-events: none;
      }
      .corner {
        position: absolute;
        width: 28px;
        height: 28px;
        border: 3px solid #00e6a3;
      }
      .corner.tl {
        top: 0;
        left: 0;
        border-right: 0;
        border-bottom: 0;
      }
      .corner.tr {
        top: 0;
        right: 0;
        border-left: 0;
        border-bottom: 0;
      }
      .corner.bl {
        bottom: 0;
        left: 0;
        border-right: 0;
        border-top: 0;
      }
      .corner.br {
        bottom: 0;
        right: 0;
        border-left: 0;
        border-top: 0;
      }

      /* Recherche */
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
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 15px;
        outline: none;
      }
      input:focus {
        border-color: #00b894;
      }

      /* Suggestions */
      .suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 48px;
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 0 0 10px 10px;
        z-index: 100;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        max-height: 260px;
        overflow-y: auto;
      }
      .suggestion-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid #f1f3f4;
        transition: background 0.15s;
      }
      .suggestion-item:hover {
        background: #f0fdf4;
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
        font-weight: 600;
        font-size: 14px;
        color: #1a1a2e;
      }
      .sug-code {
        font-size: 11px;
        color: #aaa;
      }
      .sug-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .sug-prix {
        font-size: 13px;
        font-weight: 700;
        color: #00b894;
      }
      .sug-stock {
        font-size: 11px;
        color: #636e72;
      }
      .sug-stock.bas {
        color: #e17055;
        font-weight: 600;
      }

      button {
        border: none;
        background: #00b894;
        color: #fff;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
        white-space: nowrap;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .secondary {
        background: #636e72;
      }
      .hint {
        color: #6c757d;
        font-size: 12px;
        margin-top: 8px;
      }
      .error {
        color: #d63031;
        margin-top: 8px;
      }
      .success {
        color: #00b894;
        margin-top: 8px;
      }
      .panier-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-top: 16px;
        color: #0984e3;
        font-weight: 500;
        text-decoration: none;
      }
      .cart-count {
        background: #e17055;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 11px;
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
