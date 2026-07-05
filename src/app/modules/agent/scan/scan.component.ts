import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PosService, CartItem } from '../services/pos.service';
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
          <div class="video-placeholder" [class.hidden-placeholder]="cameraActive">
            <mat-icon>photo_camera</mat-icon>
            <span>Appuyez sur Démarrer</span>
          </div>
          <video #video muted playsinline [class.hidden]="!cameraActive"></video>
          <div class="scan-frame" *ngIf="cameraActive">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
            <div class="scan-line" [class.paused]="scanPaused"></div>
          </div>
          <!-- Overlay succès après détection -->
          <div class="scan-success-overlay" *ngIf="scanPaused">
            <div class="scan-success-inner">
              <mat-icon>check_circle</mat-icon>
              <span>{{ lastProductName }}</span>
            </div>
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
        <!-- message fallback masqué : ZXing actif en silence -->
        <!-- <p class="hint" *ngIf="!cameraSupported"> -->
        <!--   BarcodeDetector non supporté: fallback ZXing activé. -->
        <!-- </p> -->
      </div>

      <!-- Recherche manuelle avec autocomplétion -->
      <div class="search-wrapper">
        <div class="scan-form">
          <input
            type="text"
            [(ngModel)]="barcode"
            (input)="onInputChange(barcode)"
            (keyup.enter)="scanProduct()"
            (blur)="onInputBlur()"
            placeholder="Nom produit ou code-barres..."
            [disabled]="isLoading"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <button (click)="scanProduct()" [disabled]="isLoading || !barcode.trim()">
            {{ isLoading ? '...' : 'Ajouter' }}
          </button>
        </div>

        <!-- Suggestions -->
        <div class="suggestions" *ngIf="suggestions.length > 0">
          <div
            class="suggestion-item"
            *ngFor="let p of suggestions; let i = index"
            [class.first]="i === 0"
            (mousedown)="$event.preventDefault()"
            (click)="selectionnerProduit(p)"
            (touchstart)="onSuggestionTouchStart(p, $event)"
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

      <p class="success" *ngIf="lastProductName">Ajouté : {{ lastProductName }}</p>
      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
      <p class="hint-enter" *ngIf="suggestions.length > 0">↵ Entrée ajoute "{{ suggestions[0].nom }}"</p>

      <div class="panier-row">
        <a routerLink="/agent/panier" class="panier-link">
          <mat-icon>shopping_cart</mat-icon>
          Aller au panier
          <span class="cart-count" *ngIf="cartCount > 0">{{ cartCount }}</span>
        </a>
        <button
          class="panier-toggle"
          *ngIf="cartItems.length > 0"
          (click)="showCartPreview = !showCartPreview"
          [class.open]="showCartPreview"
        >
          <mat-icon>{{ showCartPreview ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
      </div>

      <div class="cart-preview" *ngIf="showCartPreview && cartItems.length > 0">
        <div class="cart-preview-item" *ngFor="let item of cartItems">
          <span class="cpi-nom">{{ item.produit?.nom || 'Produit' }} <span class="cpi-qte">x{{ item.quantite }}</span></span>
          <span class="cpi-prix">{{ item.prix * item.quantite | number: '1.0-0' }} FCFA</span>
        </div>
        <div class="cart-preview-total">
          <span>Total</span>
          <span>{{ cartTotal | number: '1.0-0' }} FCFA</span>
        </div>
      </div>
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
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 1px !important;
        height: 1px !important;
      }

      .hidden-placeholder {
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
      .scan-line {
        position: absolute;
        left: 4px;
        right: 4px;
        height: 2px;
        background: var(--accent);
        box-shadow: 0 0 8px 1px var(--accent);
        opacity: 0.8;
        top: 10%;
        animation: scanMove 2s ease-in-out infinite;
      }
      .scan-line.paused {
        animation-play-state: paused;
        opacity: 0;
      }
      @keyframes scanMove {
        0%, 100% { top: 8%; }
        50% { top: 92%; }
      }

      /* Overlay succès */
      .scan-success-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 184, 148, 0.18);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: overlayIn 0.2s ease-out;
        z-index: 10;
      }
      @keyframes overlayIn {
        from { opacity: 0; transform: scale(0.95); }
        to   { opacity: 1; transform: scale(1); }
      }
      .scan-success-inner {
        background: rgba(0, 184, 148, 0.92);
        border-radius: 12px;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #fff;
        font-weight: 700;
        font-size: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      .scan-success-inner mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
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
        padding: 14px 14px;
        color: var(--text-1);
        /* 16px minimum pour éviter le zoom automatique sur iOS */
        font-size: 16px;
        outline: none;
        backdrop-filter: blur(12px);
        /* Désactiver le zoom iOS au focus */
        -webkit-text-size-adjust: 100%;
        min-height: 52px;
      }
      input::placeholder {
        color: var(--text-3);
        font-size: 14px;
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
        background: var(--navy-light);
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
        padding: 14px 14px;
        cursor: pointer;
        border-bottom: 1px solid var(--navy-border);
        transition: background 0.12s;
        /* Tap target minimum 48px recommandé pour mobile */
        min-height: 52px;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      .suggestion-item:hover,
      .suggestion-item:active {
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

      .suggestion-item.first {
        background: var(--accent-lite);
        border-left: 3px solid var(--accent);
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
      .hint-enter {
        color: var(--text-3);
        font-size: 11px;
        margin-top: 6px;
      }

      /* Panier link */
      .panier-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 16px;
      }
      .panier-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--accent);
        font-size: 14px;
        font-weight: 600;
      }
      .panier-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: var(--accent);
        cursor: pointer;
        padding: 0;
      }
      .panier-toggle mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .panier-toggle.open {
        background: var(--accent-lite);
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

      /* Aperçu panier — lecture seule */
      .cart-preview {
        margin-top: 8px;
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 12px;
        padding: 10px 12px;
        backdrop-filter: blur(12px);
        animation: previewIn 0.15s ease-out;
      }
      @keyframes previewIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .cart-preview-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid var(--navy-border);
        font-size: 13px;
      }
      .cart-preview-item:last-of-type {
        border-bottom: none;
      }
      .cpi-nom {
        color: var(--text-1);
        display: flex;
        align-items: baseline;
        gap: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cpi-qte {
        color: var(--text-3);
        font-size: 11px;
        flex-shrink: 0;
      }
      .cpi-prix {
        color: var(--text-2);
        font-size: 13px;
        font-weight: 600;
        flex-shrink: 0;
        margin-left: 8px;
      }
      .cart-preview-total {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 6px;
        padding-top: 8px;
        border-top: 1px solid var(--navy-border);
        color: var(--accent);
        font-size: 14px;
        font-weight: 700;
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
  cartItems: CartItem[] = [];
  cartTotal = 0;
  showCartPreview = false;
  scanPaused = false;
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
    private cdr: ChangeDetectorRef,
  ) {
    if (this.cameraSupported) {
      const DetectorClass = (window as any).BarcodeDetector;
      this.detector = new DetectorClass({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
      });
    } else {
      this.zxingReader = new BrowserMultiFormatReader(ScanComponent.buildZxingHints());
    }
  }

  private static buildZxingHints(): Map<DecodeHintType, unknown> {
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    return hints;
  }

  async ngOnInit(): Promise<void> {
    const tenantId = this.auth.getTenantId() ?? '';

    // 1. Cache local d'abord → affichage immédiat même hors ligne
    this.allProduits = await this.offline.getProduits(tenantId);

    // 2. TOUJOURS rafraîchir depuis l'API si en ligne
    //    (même si le cache n'est pas vide — le stock évolue côté patron)
    if (this.sync.estEnLigne()) {
      try {
        const token = localStorage.getItem('ss_token') ?? '';
        const res: any = await fetch(`${environment.apiUrl}/produits`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());

        if (res?.success && res?.data) {
          const produits = res.data.map((p: any) => ({ ...p, tenantId }));
          await this.offline.cacheProduits(tenantId, produits);
          this.allProduits = produits; // mise à jour avec les stocks à jour
          this.cdr.detectChanges();
        }
      } catch {
        // silencieux si hors ligne ou erreur réseau — on garde le cache
      }
    }

    // 3. Suivre le panier
    this.pos.cart$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      this.cartCount = items.reduce((s, i) => s + i.quantite, 0);
      this.cartItems = items;
      this.cartTotal = items.reduce((s, i) => s + i.prix * i.quantite, 0);
      if (items.length === 0) this.showCartPreview = false;
      this.cdr.detectChanges();
    });

    // 4. Réagir à chaque mise à jour du cache Dexie (bouton refresh manuel
    //    ou décrément post-vente) → recharger allProduits immédiatement
    this.offline.produitsUpdated$.pipe(takeUntil(this.destroy$)).subscribe(async () => {
      this.allProduits = await this.offline.getProduits(tenantId);
      this.cdr.detectChanges();
    });

    // 5. Polling automatique toutes les 60s pour rester synchronisé avec
    //    les changements stock faits par le patron (réapprovisionnement, etc.)
    interval(60_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        if (this.sync.estEnLigne()) {
          await this.offline.syncProduitsFromServer(tenantId);
          // produitsUpdated$ s'émet dans syncProduitsFromServer → allProduits rechargé automatiquement
        }
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

  // Blur retardé : laisse 200ms pour qu'un tap sur suggestion soit traité
  // avant de fermer la liste (sur mobile, blur arrive ~100ms avant click/touchend)
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

  onInputBlur(): void {
    this.blurTimer = setTimeout(() => {
      this.suggestions = [];
    }, 200);
  }

  // touchstart déclenché AVANT blur — on annule le timer de fermeture
  // et on sélectionne immédiatement le produit
  onSuggestionTouchStart(produit: any, event: TouchEvent): void {
    event.preventDefault(); // empêche le blur de l'input
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    this.selectionnerProduit(produit);
  }

  selectionnerProduit(produit: CachedProduit): void {
    this.suggestions = [];
    this.barcode = '';

    // Bloquer si rupture de stock
    const stock = Number(produit.stock ?? -1);
    if (stock === 0) {
      this.errorMessage = `"${produit.nom}" est en rupture de stock`;
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }
    // Bloquer si déjà au max en panier
    const enPanier = this.cartItems.find(i => i.produit?._id === produit._id)?.quantite ?? 0;
    if (stock > 0 && enPanier >= stock) {
      this.errorMessage = `Stock max atteint pour "${produit.nom}" (${stock} unité${stock > 1 ? 's' : ''})`;
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }

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

    // Si des suggestions sont affichées (recherche par nom partielle), Entrée
    // valide la premiere suggestion au lieu de tenter une recherche exacte
    // (cache + API barcode) qui echoue quasi systematiquement sur une saisie
    // partielle -> c'etait la cause du "barcode/er 404" en tapant un debut de nom.
    if (this.suggestions.length > 0) {
      this.selectionnerProduit(this.suggestions[0]);
      return;
    }

    this.suggestions = [];
    this.errorMessage = '';
    this.lastProductName = '';
    this.isLoading = true;

    // 1. Chercher dans le cache local d'abord
    const fromCache =
      (await this.offline.getProduitByBarcode(code)) ||
      this.allProduits.find((p) => p.nom.toLowerCase() === code.toLowerCase());

    if (fromCache) {
      const stock = Number(fromCache.stock ?? -1);
      const enPanier = this.cartItems.find(i => i.produit?._id === fromCache._id)?.quantite ?? 0;
      if (stock === 0) {
        this.errorMessage = `"${fromCache.nom}" est en rupture de stock`;
        this.isLoading = false;
        setTimeout(() => (this.errorMessage = ''), 3000);
        return;
      }
      if (stock > 0 && enPanier >= stock) {
        this.errorMessage = `Stock max atteint pour "${fromCache.nom}" (${stock} unité${stock > 1 ? 's' : ''})`;
        this.isLoading = false;
        setTimeout(() => (this.errorMessage = ''), 3000);
        return;
      }
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
            const stock = Number(produit?.stock ?? -1);
            const enPanier = this.cartItems.find(i => i.produit?._id === produit?._id)?.quantite ?? 0;
            if (stock === 0) {
              this.errorMessage = `"${produit?.nom}" est en rupture de stock`;
              this.isLoading = false;
              setTimeout(() => (this.errorMessage = ''), 3000);
              return;
            }
            if (stock > 0 && enPanier >= stock) {
              this.errorMessage = `Stock max atteint (${stock} unité${stock > 1 ? 's' : ''})`;
              this.isLoading = false;
              setTimeout(() => (this.errorMessage = ''), 3000);
              return;
            }
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
    if (this.cameraActive || this.isStarting) return;
    this.isStarting = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await this.startCameraScan();
  }

  async startCameraScan(): Promise<void> {
    this.cdr.detectChanges();
    if (!this.videoRef?.nativeElement) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getCameraConstraints());
      const video = this.videoRef.nativeElement;
      video.srcObject = this.mediaStream;

      // Attendre que la vidéo soit prête avant de marquer actif
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
        setTimeout(() => resolve(), 3000); // sécurité si l'event ne se déclenche pas
      });
      try {
        await video.play();
      } catch (playErr: any) {
        // AbortError bénigne (ex: play() interrompu par un nouveau load) — on continue,
        // le flux est déjà attaché via srcObject et jouera de toute façon.
        if (playErr?.name !== 'AbortError') throw playErr;
      }
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
        // Boucle canvas manuelle : contourne le bug de decodeFromVideoElement
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        let stopLoop = false;
        this.zxingControls = { stop: () => { stopLoop = true; } } as any;
        const loop = () => {
          if (stopLoop || !this.cameraActive) return;
          if (!this.scanPaused && video.readyState >= 2 && video.videoWidth > 0) {
            try {
              // Réduire à 640px max pour accélérer ZXing (1280px = 4x plus de pixels à analyser)
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width  = Math.round(video.videoWidth  * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const result = this.zxingReader!.decodeFromCanvas(canvas);
              if (result?.getText()) this.onCameraCodeDetected(result.getText());
            } catch { /* NotFound/Checksum/Format sont normales */ }
          }
          if (!stopLoop) setTimeout(loop, 120);
        };
        loop();
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
    if (this.isProcessingCameraCode || this.scanPaused) return;
    this.isProcessingCameraCode = true;
    this.scanPaused = true;
    this.barcode = code;
    this.cdr.detectChanges();
    this.scanProduct();
    // Pause 2.5s : overlay visible, ligne de scan arrêtée, anti-doublon
    setTimeout(() => {
      this.scanPaused = false;
      this.isProcessingCameraCode = false;
      this.cdr.detectChanges();
    }, 2500);
  }

  async switchCamera(): Promise<void> {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (!this.cameraActive) return;
    this.stopCameraScan();
    await this.startCameraScan();
  }

  stopCameraScan(): void {
    this.cameraActive = false;
    this.scanPaused = false;
    this.isProcessingCameraCode = false;
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
