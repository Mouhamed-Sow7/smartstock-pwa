import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { PosService } from '../services/pos.service';

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
      <p>Scannez via caméra ou saisissez le code-barres.</p>

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
          <button (click)="startCameraScan()" [disabled]="cameraActive || !cameraAvailable">
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

      <div class="scan-form">
        <input
          type="text"
          [(ngModel)]="barcode"
          (keyup.enter)="scanProduct()"
          placeholder="Code-barres"
          [disabled]="isLoading"
        />
        <button (click)="scanProduct()" [disabled]="isLoading || !barcode.trim()">
          {{ isLoading ? 'Recherche...' : 'Ajouter' }}
        </button>
      </div>

      <p class="success" *ngIf="lastProductName">Ajouté: {{ lastProductName }}</p>
      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

      <a routerLink="/agent/panier" class="panier-link">
        <mat-icon>shopping_cart</mat-icon>
        Aller au panier
      </a>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 860px;
        margin: 0 auto;
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
      .scan-form {
        display: flex;
        gap: 8px;
        margin: 12px 0;
      }
      input {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px;
      }
      button {
        border: none;
        background: #00b894;
        color: #fff;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
      }
      .error {
        color: #d63031;
      }
      .success {
        color: #00b894;
      }
      .secondary {
        background: #636e72;
      }
      .hint {
        color: #6c757d;
        font-size: 12px;
        margin-top: 8px;
      }
      .panier-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    `,
  ],
})
export class ScanComponent implements OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  barcode = '';
  isLoading = false;
  errorMessage = '';
  lastProductName = '';
  cameraActive = false;
  cameraAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  facingMode: 'environment' | 'user' = 'environment';

  private detector: BarcodeDetectorLike | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private zxingControls: IScannerControls | null = null;
  private mediaStream: MediaStream | null = null;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessingCameraCode = false;
  private destroy$ = new Subject<void>();

  constructor(private pos: PosService) {
    if (this.cameraSupported) {
      const DetectorClass = (window as any).BarcodeDetector;
      this.detector = new DetectorClass({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
      });
    } else {
      this.zxingReader = new BrowserMultiFormatReader();
    }
  }

  scanProduct(): void {
    const code = this.barcode.trim();
    if (!code) return;

    this.errorMessage = '';
    this.lastProductName = '';
    this.isLoading = true;
    this.pos
      .searchByBarcode(code)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: (produit) => {
          this.pos.addToCart(produit);
          this.lastProductName = produit?.nom || 'Produit';
          this.playSuccessSound();
          this.barcode = '';
        },
        error: () => {
          this.errorMessage = 'Produit non trouvé';
        },
      });
  }

  async startCameraScan(): Promise<void> {
    if (!this.videoRef?.nativeElement || this.cameraActive) return;

    this.errorMessage = '';
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode },
      });
      const video = this.videoRef.nativeElement;
      video.srcObject = this.mediaStream;
      await video.play();
      this.cameraActive = true;

      if (this.detector) {
        this.scanInterval = setInterval(async () => {
          if (!this.detector || this.isProcessingCameraCode || !this.cameraActive) return;
          try {
            const results = await this.detector.detect(video);
            const code = results?.[0]?.rawValue?.trim();
            if (code) this.onCameraCodeDetected(code);
          } catch {
            // ignore frame decode errors
          }
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
      this.errorMessage = "Impossible d'accéder à la caméra";
    }
  }

  private onCameraCodeDetected(code: string): void {
    if (this.isProcessingCameraCode) return;
    this.isProcessingCameraCode = true;
    this.barcode = code;
    this.scanProduct();
    setTimeout(() => {
      this.isProcessingCameraCode = false;
    }, 1000);
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
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  private playSuccessSound(): void {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.08);
  }

  ngOnDestroy(): void {
    this.stopCameraScan();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
