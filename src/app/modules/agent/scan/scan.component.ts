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
import { checksumEanValide } from '../../../core/utils/barcode-checksum';
import { I18nService } from '../../../core/services/i18n.service';

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
        <div class="scan-title">{{ i18n.lang() === 'ar' ? 'مسح منتج' : 'Scanner Produit' }}</div>
        <div class="scan-sub">{{ i18n.lang() === 'ar' ? 'كاميرا أو إدخال بالاسم / الباركود' : 'Caméra ou saisie par nom / code-barres' }}</div>
      </div>

      <!-- Caméra -->
      <div class="camera-card">
        <div class="camera-head">
          <mat-icon>photo_camera</mat-icon>
          <strong>{{ i18n.lang() === 'ar' ? 'مسح بالكاميرا' : 'Scan caméra' }}</strong>
        </div>

        <div class="video-wrapper">
          <div class="video-placeholder" [class.hidden-placeholder]="cameraActive">
            <mat-icon>photo_camera</mat-icon>
            <span>{{ i18n.lang() === 'ar' ? 'اضغط على ابدأ' : 'Appuyez sur Démarrer' }}</span>
          </div>
          <video #video muted playsinline [class.hidden]="!cameraActive"></video>
          <div class="scan-frame" *ngIf="cameraActive">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
            <div class="scan-line" [class.paused]="scanPaused"></div>
          </div>
          <!-- Overlay apres detection : spinner pendant la resolution, puis
               succes ou erreur selon le resultat reel — jamais un succes
               affiche par avance (voir onCameraCodeDetected/finirPauseScan). -->
          <div class="scan-success-overlay" *ngIf="scanPaused">
            <div class="scan-success-inner" *ngIf="isLoading">
              <mat-icon class="verif-spin">autorenew</mat-icon>
              <span>Vérification...</span>
            </div>
            <div class="scan-success-inner error" *ngIf="!isLoading && errorMessage">
              <mat-icon>error</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>
            <div class="scan-success-inner" *ngIf="!isLoading && !errorMessage">
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
            {{ isStarting ? (i18n.lang() === 'ar' ? 'جارٍ التشغيل...' : 'Démarrage...') : (i18n.lang() === 'ar' ? 'تشغيل الكاميرا' : 'Démarrer caméra') }}
          </button>
          <button class="secondary" (click)="switchCamera()" [disabled]="!cameraActive">
            {{ i18n.lang() === 'ar' ? 'تبديل الكاميرا' : 'Basculer caméra' }}
          </button>
          <button class="secondary" (click)="stopCameraScan()" [disabled]="!cameraActive">
            {{ i18n.lang() === 'ar' ? 'إيقاف' : 'Arrêter' }}
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
            [placeholder]="i18n.lang() === 'ar' ? 'اسم المنتج أو الباركود...' : 'Nom produit ou code-barres...'"
            [disabled]="isLoading"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <button (click)="scanProduct()" [disabled]="isLoading || !barcode.trim()">
            {{ isLoading ? '...' : (i18n.lang() === 'ar' ? 'إضافة' : 'Ajouter') }}
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
            (touchmove)="onSuggestionTouchMove($event)"
            (touchend)="onSuggestionTouchEnd(p, $event)"
          >
            <div class="sug-info">
              <span class="sug-nom">{{ p.nom }}</span>
              <span class="sug-code" *ngIf="p.codeBarres">{{ p.codeBarres }}</span>
            </div>
            <div class="sug-right">
              <span class="sug-prix">{{ p.prix | number: '1.0-0' }} FCFA</span>
              <span class="sug-stock" [class.bas]="p.stock <= (p.seuilAlerte || 5)">
                {{ i18n.lang() === 'ar' ? 'المخزون' : 'Stock' }}: {{ p.stock }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p class="success" *ngIf="lastProductName">{{ i18n.lang() === 'ar' ? 'أُضيف' : 'Ajouté' }} : {{ lastProductName }}</p>
      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
      <p class="hint-enter" *ngIf="suggestions.length > 0">↵ {{ i18n.lang() === 'ar' ? 'إدخال يضيف' : 'Entrée ajoute' }} "{{ suggestions[0].nom }}"</p>

      <div class="panier-row">
        <a routerLink="/agent/panier" class="panier-link">
          <mat-icon>shopping_cart</mat-icon>
          {{ i18n.lang() === 'ar' ? 'الذهاب إلى السلة' : 'Aller au panier' }}
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
          <span class="cpi-nom">{{ item.produit?.nom || (i18n.lang() === 'ar' ? 'منتج' : 'Produit') }} <span class="cpi-qte">x{{ item.quantite }}</span></span>
          <span class="cpi-prix">{{ item.prix * item.quantite | number: '1.0-0' }} FCFA</span>
        </div>
        <div class="cart-preview-total">
          <span>{{ i18n.t('panier.total') }}</span>
          <span>{{ cartTotal | number: '1.0-0' }} FCFA</span>
        </div>
      </div>
    </div>

    <!-- Choix Détail / Gros — bloque tant que l'agent n'a pas tranché -->
    <div class="type-vente-overlay" *ngIf="produitEnChoixType">
      <div class="type-vente-sheet">
        <div class="tv-nom">{{ produitEnChoixType.nom }}</div>
        <div class="tv-sub">{{ i18n.t('scan.choisirTypeVente') }} :</div>
        <div class="tv-options">
          <button class="tv-option" (click)="choisirTypeVente('detail')">
            <mat-icon>storefront</mat-icon>
            <span class="tv-option-label">{{ i18n.t('scan.detail') }}</span>
            <span class="tv-option-prix">{{ produitEnChoixType.prix | number:'1.0-0' }} FCFA</span>
          </button>
          <button class="tv-option gros" (click)="choisirTypeVente('gros')">
            <mat-icon>inventory_2</mat-icon>
            <span class="tv-option-label">{{ i18n.t('scan.gros') }}</span>
            <span class="tv-option-prix">{{ produitEnChoixType.prixGros | number:'1.0-0' }} FCFA</span>
          </button>
        </div>
        <button class="tv-cancel" (click)="annulerChoixType()">{{ i18n.lang() === 'ar' ? 'إلغاء' : 'Annuler' }}</button>
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
        background: rgba(6,14,26,0.55);
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
        max-width: 90%;
        text-align: center;
      }
      .scan-success-inner.error {
        background: rgba(231, 76, 60, 0.92);
      }
      .scan-success-inner mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
      }
      .scan-success-inner .verif-spin {
        animation: verif-spin-anim 0.8s linear infinite;
      }
      @keyframes verif-spin-anim {
        to { transform: rotate(360deg); }
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
        -webkit-overflow-scrolling: touch;
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
        touch-action: pan-y; /* autorise explicitement le scroll vertical du doigt */
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

      /* Choix Détail / Gros */
      .type-vente-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.6);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        z-index: 1000;
      }
      .type-vente-sheet {
        width: 100%;
        max-width: 480px;
        background: var(--navy-card);
        border: 1px solid var(--navy-border);
        border-radius: 20px 20px 0 0;
        padding: 20px;
        padding-bottom: max(20px, env(safe-area-inset-bottom));
      }
      .tv-nom { color: var(--text-1); font-size: 17px; font-weight: 800; }
      .tv-sub { color: var(--text-3); font-size: 13px; margin-top: 4px; margin-bottom: 16px; }
      .tv-options { display: flex; gap: 10px; }
      .tv-option {
        flex: 1;
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        background: var(--navy);
        border: 1.5px solid var(--navy-border);
        border-radius: 14px;
        padding: 18px 10px;
        cursor: pointer;
        color: var(--text-1);
      }
      .tv-option mat-icon { font-size: 26px; width: 26px; height: 26px; color: var(--accent); }
      .tv-option.gros mat-icon { color: #fdcb6e; }
      .tv-option-label { font-size: 14px; font-weight: 700; }
      .tv-option-prix { font-size: 13px; color: var(--text-3); font-weight: 600; }
      .tv-option:active { transform: scale(0.97); }
      .tv-cancel {
        width: 100%; margin-top: 14px;
        background: transparent; border: none;
        color: var(--text-3); font-size: 13px; font-weight: 600;
        padding: 8px; cursor: pointer;
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
  // Produit à double prix en attente d'un choix Détail/Gros — tant qu'il est
  // défini, aucun scan (caméra ou recherche) n'est traité, voir scanProduct()
  // et onCameraCodeDetected().
  produitEnChoixType: any = null;

  private detector: BarcodeDetectorLike | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private zxingControls: IScannerControls | null = null;
  private mediaStream: MediaStream | null = null;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private scanRafId: number | null = null;
  private lastDetectTs = 0;
  private isProcessingCameraCode = false;
  // Candidat en attente de confirmation (2 lectures identiques d'affilée) —
  // voir onCameraCodeDetected().
  private candidatCode = '';
  private candidatCount = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private pos: PosService,
    private offline: OfflineService,
    private auth: AuthService,
    private sync: SyncService,
    private cdr: ChangeDetectorRef,
    public i18n: I18nService,
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
    // Wrapper dans try/catch : si Dexie est en migration ou corrompu, on
    // ne bloque pas tout ngOnInit (scan et panier resteraient inactifs).
    try {
      this.allProduits = await this.offline.getProduits(tenantId);
    } catch (e) {
      console.error('[scan] Dexie getProduits:', e);
      this.allProduits = [];
    }

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
          try {
            await this.offline.cacheProduits(tenantId, produits);
          } catch { /* silencieux si Dexie pas encore prête */ }
          this.allProduits = produits;
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

  // touchstart déclenché AVANT blur — on annule le timer de fermeture pour
  // garder la liste ouverte, mais on NE sélectionne PLUS ici (voir le
  // correctif touchmove/touchend juste en dessous).
  //
  // BUG CORRIGÉ : sélectionner dès touchstart ajoutait le produit au panier
  // au moindre contact du doigt, y compris pour amorcer un scroll de la
  // liste — impossible de scroller sans ajouter involontairement un article
  // non désiré. On distingue maintenant un vrai tap (peu de mouvement) d'un
  // scroll (mouvement > seuil) via touchmove, et on ne sélectionne qu'au
  // relâchement (touchend) si ça n'a pas bougé.
  onSuggestionTouchStart(produit: any, event: TouchEvent): void {
    event.preventDefault(); // empêche le blur de l'input (comportement conservé)
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    const t = event.touches[0];
    this.sugTouchStartX = t.clientX;
    this.sugTouchStartY = t.clientY;
    this.sugTouchADepasseLeSeuil = false;
  }

  // Seuil généreux (10px) — au-delà, on considère que le doigt scrolle la
  // liste et plus du tout qu'il vise cet article précis.
  onSuggestionTouchMove(event: TouchEvent): void {
    if (this.sugTouchADepasseLeSeuil) return;
    const t = event.touches[0];
    const dx = Math.abs(t.clientX - this.sugTouchStartX);
    const dy = Math.abs(t.clientY - this.sugTouchStartY);
    if (dx > 10 || dy > 10) this.sugTouchADepasseLeSeuil = true;
  }

  onSuggestionTouchEnd(produit: any, event: TouchEvent): void {
    if (this.sugTouchADepasseLeSeuil) return; // c'était un scroll, pas un tap
    this.selectionnerProduit(produit);
  }

  private sugTouchStartX = 0;
  private sugTouchStartY = 0;
  private sugTouchADepasseLeSeuil = false;

  selectionnerProduit(produit: CachedProduit): void {
    this.suggestions = [];
    this.barcode = '';
    this.traiterProduitResolu(produit);
  }

  // Point d'entrée unique après résolution d'un produit (recherche manuelle,
  // cache offline, ou API) — centralise les contrôles de stock ET le choix
  // détail/gros pour ne jamais avoir 3 implémentations qui divergent.
  private traiterProduitResolu(produit: any): void {
    const stock = Number(produit?.stock ?? -1);
    const nom = produit?.nom || 'Produit';
    if (stock === 0) {
      this.errorMessage = `"${nom}" est en rupture de stock`;
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }
    // Quantité déjà au panier pour ce produit, tous types de vente confondus
    // (détail + gros partagent le même stock physique — même unité).
    const enPanier = this.pos.quantiteAuPanier(produit._id);
    if (stock > 0 && enPanier >= stock) {
      this.errorMessage = `Stock max atteint pour "${nom}" (${stock} unité${stock > 1 ? 's' : ''})`;
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }
    this.errorMessage = '';

    if (Number(produit?.prixGros) > 0) {
      // Produit vendable en détail ET en gros : on bloque l'ajout tant que
      // l'agent n'a pas choisi lequel — jamais de ligne créée "par défaut"
      // avec le mauvais prix. Le scan caméra est mis en pause pendant ce
      // choix (voir gabarits onCameraCodeDetected/scanProduct).
      this.produitEnChoixType = produit;
      this.cdr.detectChanges();
      return;
    }
    this.ajouterAuPanier(produit, 'detail');
  }

  private ajouterAuPanier(produit: any, typeVente: 'detail' | 'gros'): void {
    this.pos.addToCart(produit, typeVente);
    this.lastProductName = produit.nom + (typeVente === 'gros' ? ' (gros)' : '');
    this.playSuccessSound();
    setTimeout(() => (this.lastProductName = ''), 2000);
  }

  choisirTypeVente(type: 'detail' | 'gros'): void {
    if (!this.produitEnChoixType) return;
    this.ajouterAuPanier(this.produitEnChoixType, type);
    this.produitEnChoixType = null;
  }

  annulerChoixType(): void {
    this.produitEnChoixType = null;
  }

  // ─── Scan par code-barres ───────────────────────────────────

  async scanProduct(): Promise<void> {
    const code = this.barcode.trim();
    if (!code) return;

    // Un choix détail/gros est en attente : on bloque tout nouveau scan tant
    // qu'il n'est pas résolu, sinon un 2e scan pourrait écraser silencieusement
    // le choix en cours (et perdre le 1er produit scanné).
    if (this.produitEnChoixType) return;

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

    // 1. Chercher dans le cache local d'abord (Dexie), puis en repli dans
    // allProduits (source utilisée par la recherche manuelle, souvent plus à
    // jour) — en comparant code-barres ET nom, pas seulement le nom, sinon
    // un scan caméra ne matchait jamais alors que la recherche manuelle si.
    let fromCache;
    try {
      fromCache =
        (await this.offline.getProduitByBarcode(code)) ||
        this.allProduits.find(
          (p) => p.codeBarres === code || p.nom.toLowerCase() === code.toLowerCase(),
        );
    } catch {
      fromCache = this.allProduits.find((p) =>
        p.codeBarres === code || p.nom.toLowerCase() === code.toLowerCase()
      );
    }

    if (fromCache) {
      this.isLoading = false;
      this.barcode = '';
      this.traiterProduitResolu(fromCache);
      return;
    }

    // 2. Si en ligne → appel API
    if (this.sync.estEnLigne()) {
      this.pos
        .searchByBarcode(code)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (produit) => {
            this.isLoading = false;
            this.barcode = '';
            this.traiterProduitResolu(produit);
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
        // requestAnimationFrame pour la fluidité, throttlé à 150ms pour éviter
        // de saturer detect() (qui est coûteux) tout en restant réactif.
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
        // Boucle canvas manuelle : contourne le bug de decodeFromVideoElement
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        let stopLoop = false;
        this.zxingControls = { stop: () => { stopLoop = true; } } as any;
        const loop = () => {
          if (stopLoop || !this.cameraActive) return;
          if (!this.scanPaused && video.readyState >= 2 && video.videoWidth > 0) {
            try {
              // Crop centré (zone du cadre de visée affiché à l'écran) plutôt que
              // downscale de l'image entière : moins de pixels à décoder (plus
              // rapide, important sur iOS où ZXing tourne au CPU) tout en gardant
              // la résolution native 1:1 sur la zone utile (meilleure lecture des
              // petits codes-barres, sans le flou d'un redimensionnement).
              const cropW = Math.round(video.videoWidth * 0.85);
              const cropH = Math.round(video.videoHeight * 0.45);
              const sx = Math.round((video.videoWidth - cropW) / 2);
              const sy = Math.round((video.videoHeight - cropH) / 2);
              canvas.width = cropW;
              canvas.height = cropH;
              ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
              const result = this.zxingReader!.decodeFromCanvas(canvas);
              if (result?.getText()) this.onCameraCodeDetected(result.getText());
            } catch { /* NotFound/Checksum/Format sont normales */ }
          }
          if (!stopLoop) setTimeout(loop, 80);
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
    // BarcodeDetector natif (Chrome/Android) : décodage matériel, la haute
    // résolution ne coûte quasi rien. ZXing (fallback Safari/iOS — l'API
    // BarcodeDetector n'existe pas dans WebKit) : décodage CPU pur en JS,
    // donc chaque pixel en plus ralentit directement la boucle de détection.
    // On demande une résolution plus basse dans ce cas pour rester réactif
    // sur des appareils comme l'iPhone 11 — largement suffisant pour lire
    // un code-barres (pas besoin de détail photo, juste du contraste net).
    const surZxing = !this.detector;
    return {
      video: {
        facingMode: { ideal: this.facingMode },
        width: surZxing ? { min: 640, ideal: 1280, max: 1920 } : { min: 640, ideal: 1920, max: 3840 },
        height: surZxing ? { min: 480, ideal: 720, max: 1080 } : { min: 480, ideal: 1080, max: 2160 },
        // @ts-ignore focusMode n'est pas encore dans le type MediaTrackConstraints standard
        advanced: [{ focusMode: 'continuous' }],
      } as MediaTrackConstraints,
    };
  }

  private onCameraCodeDetected(code: string): void {
    if (this.isProcessingCameraCode || this.scanPaused || this.produitEnChoixType) return;

    // Rejette tout de suite un code au checksum EAN/UPC invalide — presque
    // toujours un chiffre mal lu par la caméra, jamais un vrai code-barres
    // imprimé. Voir barcode-checksum.ts pour le détail.
    if (!checksumEanValide(code)) {
      this.candidatCode = '';
      this.candidatCount = 0;
      return;
    }

    // BUG CORRIGÉ : une seule lecture caméra suffisait à ajouter un produit
    // au panier de vente — une lecture isolée peut se tromper sur un
    // chiffre, ce qui ajoutait parfois le MAUVAIS produit à la vente (risque
    // direct d'erreur de caisse, pas juste de confort). On exige maintenant
    // la même lecture 2 fois de suite avant de valider.
    if (code !== this.candidatCode) {
      this.candidatCode = code;
      this.candidatCount = 1;
      return;
    }
    this.candidatCount++;
    if (this.candidatCount < 2) return;
    this.candidatCode = '';
    this.candidatCount = 0;

    this.isProcessingCameraCode = true;
    this.scanPaused = true;
    this.barcode = code;
    this.cdr.detectChanges();
    this.scanProduct();
    // Pause 2.5s minimum : overlay visible, ligne de scan arrêtée, anti-doublon.
    // AMÉLIORATION : un délai fixe seul ne suffit pas — si le réseau met plus
    // de 2.5s (ex: réveil à froid de l'API backend, déjà documenté comme
    // cause de latence sur ce projet), le scan se réactivait AVANT que la
    // recherche produit soit terminée, ouvrant une fenêtre où un second scan
    // pouvait ajouter le même article une deuxième fois au panier sans que
    // le premier ait même abouti. finirPauseScan() attend maintenant aussi
    // explicitement la fin réelle de la recherche (isLoading) en plus du
    // délai minimum, quitte à rallonger la pause de quelques centaines de ms
    // sur un réseau lent — jamais l'inverse.
    setTimeout(() => this.finirPauseScan(), 2500);
  }

  // Relâche le scan seulement une fois la recherche produit réellement
  // terminée (isLoading===false) — jamais avant, même si le délai minimum
  // de pause (2.5s, déjà écoulé quand cette fonction est appelée la première
  // fois) est dépassé. Se re-vérifie toutes les 300ms tant que ça traite
  // encore, au lieu de libérer aveuglément le scan sur un simple timer.
  private finirPauseScan(): void {
    if (this.isLoading) {
      setTimeout(() => this.finirPauseScan(), 300);
      return;
    }
    this.scanPaused = false;
    this.isProcessingCameraCode = false;
    this.cdr.detectChanges();
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
    if (this.scanRafId !== null) {
      cancelAnimationFrame(this.scanRafId);
      this.scanRafId = null;
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
