import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PosService, CartItem } from '../services/pos.service';
import { I18nService } from '../../../core/services/i18n.service';

type ModePaiement = 'especes' | 'wave' | 'orange_money' | 'free_money' | 'credit';

@Component({
  selector: 'app-panier',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="panier">
      <!-- Header -->
      <div class="page-header">
        <div class="page-title">
          <mat-icon>shopping_cart</mat-icon>
          <div>
            <div class="title-main">{{ i18n.t('panier.titre') }}</div>
            <div class="title-sub">{{ items.length }} {{ i18n.t('panier.articles') }}</div>
          </div>
        </div>
      </div>

      <!-- Panier vide -->
      <div class="empty-state" *ngIf="items.length === 0">
        <mat-icon>remove_shopping_cart</mat-icon>
        <div class="empty-title">{{ i18n.t('panier.vide') }}</div>
        <div class="empty-sub">{{ i18n.t('panier.videSub') }}</div>
      </div>

      <!-- Liste articles -->
      <div class="items-list" *ngIf="items.length > 0">
        <div class="item-card" *ngFor="let item of items">
          <div class="item-info">
            <div class="item-nom">
              {{ item.produit?.nom }}
              <span class="item-type-badge" [class.gros]="item.typeVente === 'gros'" *ngIf="item.typeVente === 'gros'">{{ i18n.t('scan.gros') }}</span>
              <span class="item-modifie-badge" *ngIf="estPrixModifie(item)" [title]="i18n.lang() === 'ar' ? 'السعر معدَّل لهذا البيع فقط' : 'Prix modifié pour cette vente uniquement'">
                <mat-icon>edit</mat-icon>
              </span>
            </div>
            <div class="item-prix">{{ item.prix | number: '1.0-0' }} FCFA / {{ i18n.t('panier.unite') }}</div>
          </div>
          <div class="item-controls">
            <button class="ctrl-btn" (click)="decrement(item)">
              <mat-icon>remove</mat-icon>
            </button>
            <span class="item-qty">{{ item.quantite }}</span>
            <button class="ctrl-btn accent" (click)="increment(item)">
              <mat-icon>add</mat-icon>
            </button>
            <button class="ctrl-btn danger" (click)="remove(item)">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>

          <!-- Sous-total : cliquable pour surcharger le prix de cette ligne
               (ex : "3 cubes Maggi à 100F" au lieu du prix catalogue). Ne
               modifie jamais le prix produit lui-même, uniquement cette vente. -->
          <div class="item-subtotal" *ngIf="cleEnEdition !== ligneCle(item)" (click)="ouvrirEditionPrix(item)">
            {{ item.prix * item.quantite | number: '1.0-0' }} FCFA
            <mat-icon class="edit-prix-icon">edit</mat-icon>
          </div>
          <div class="item-subtotal-edit" *ngIf="cleEnEdition === ligneCle(item)">
            <input
              #prixInput
              type="number"
              inputmode="decimal"
              min="0"
              class="prix-edit-input"
              [(ngModel)]="prixEditValeur"
              (keyup.enter)="validerEditionPrix(item)"
              (blur)="validerEditionPrix(item)"
              name="prixEdit"
            />
            <span class="prix-edit-fcfa">FCFA</span>
          </div>
        </div>
        <p class="prix-edit-hint" *ngIf="items.length > 0">
          <mat-icon>info</mat-icon>
          {{ i18n.lang() === 'ar'
            ? 'يمكنك تعديل مجموع أي سطر (مثال: 3 قطع بسعر إجمالي مخفّض) — لا يغيّر ذلك سعر المنتج في الكتالوج.'
            : "Vous pouvez ajuster le total d'une ligne (ex : lot de 3 à prix réduit) — ça ne change pas le prix catalogue du produit." }}
        </p>
      </div>

      <!-- Footer total + validation -->
      <div class="panier-footer" *ngIf="items.length > 0">
        <div class="total-row">
          <span class="total-label">{{ i18n.t('panier.total') }}</span>
          <span class="total-value">{{ total | number: '1.0-0' }} FCFA</span>
        </div>

        <!-- Sélecteur mode paiement -->
        <div class="paiement-section">
          <div class="paiement-label">{{ i18n.t('panier.modePaiement') }}</div>
          <div class="paiement-grid">
            <button
              *ngFor="let m of modes"
              class="mode-btn"
              [class.selected]="modePaiement === m.value"
              (click)="modePaiement = m.value"
            >
              <span class="mode-logo" [innerHTML]="m.svg"></span>
              <span class="mode-name">{{ labelFor(m) }}</span>
              <mat-icon class="mode-check" *ngIf="modePaiement === m.value">check_circle</mat-icon>
            </button>
          </div>
        </div>

        <!-- Vente à crédit : nom du client obligatoire pour créer/retrouver sa fiche -->
        <div class="credit-section" *ngIf="modePaiement === 'credit'">
          <label class="credit-label">{{ i18n.t('panier.nomClient') }}</label>
          <input
            type="text"
            class="credit-input"
            [(ngModel)]="clientNom"
            [placeholder]="i18n.t('panier.nomClientPlaceholder')"
            name="clientNom"
          />
          <p class="credit-hint">
            <mat-icon>info</mat-icon>
            {{ i18n.lang() === 'ar'
              ? 'يغادر الزبون بالبضاعة دون دفع. سيجد صاحب المتجر ذلك في «القروض» لمتابعة السداد — الزبون نفسه لا يتلقى أي إشعار.'
              : "Le client repart avec la marchandise sans payer. Le patron le retrouvera dans « Prêts » pour suivre le remboursement — le client, lui, n'est pas notifié." }}
          </p>
        </div>

        <button class="validate-btn" (click)="demanderConfirmation()" [disabled]="isSaving || !peutValider">
          <mat-icon>{{ isSaving ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
          {{ isSaving ? i18n.t('panier.validation') : i18n.t('panier.valider') + ' — ' + modeLabel }}
        </button>
        <p class="offline-msg" *ngIf="offlineMsg">
          <mat-icon>wifi_off</mat-icon> {{ offlineMsg }}
        </p>
        <p class="error-msg" *ngIf="errorMessage">
          <mat-icon>error_outline</mat-icon> {{ errorMessage }}
        </p>
      </div>
    </div>

    <!-- Confirmation avant validation — un instant pour vérifier avant
         d'enregistrer réellement la vente, surtout après un prix ajusté. -->
    <div class="confirm-overlay" *ngIf="showConfirmation">
      <div class="confirm-sheet">
        <mat-icon class="confirm-icon">receipt_long</mat-icon>
        <div class="confirm-titre">{{ i18n.lang() === 'ar' ? 'تأكيد البيع؟' : 'Confirmer la vente ?' }}</div>
        <div class="confirm-lignes">
          <div class="confirm-ligne" *ngFor="let item of items">
            <span>{{ item.produit?.nom }} ×{{ item.quantite }}</span>
            <span>{{ item.prix * item.quantite | number: '1.0-0' }} F</span>
          </div>
        </div>
        <div class="confirm-total">
          <span>{{ i18n.t('panier.total') }}</span>
          <span class="confirm-total-valeur">{{ total | number: '1.0-0' }} FCFA</span>
        </div>
        <div class="confirm-mode">
          <mat-icon>payments</mat-icon> {{ modeLabel }}
          <span *ngIf="modePaiement === 'credit' && clientNom"> — {{ clientNom }}</span>
        </div>
        <div class="confirm-actions">
          <button class="confirm-non" (click)="showConfirmation = false">
            {{ i18n.lang() === 'ar' ? 'لا، تراجع' : 'Non, revenir' }}
          </button>
          <button class="confirm-oui" (click)="confirmerEtValider()">
            <mat-icon>check</mat-icon> {{ i18n.lang() === 'ar' ? 'نعم، تأكيد' : 'Oui, valider' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .panier { max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

    .page-header { margin-bottom: 4px; }
    .page-title { display: flex; align-items: center; gap: 12px; }
    .page-title mat-icon { color: var(--accent); font-size: 28px; width: 28px; height: 28px; }
    .title-main { color: var(--text-1); font-size: 22px; font-weight: 700; }
    .title-sub { color: var(--text-3); font-size: 12px; margin-top: 2px; }

    .empty-state {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 16px; padding: 48px 24px; text-align: center; backdrop-filter: blur(12px);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--text-3); margin-bottom: 12px; }
    .empty-title { color: var(--text-2); font-size: 16px; font-weight: 600; }
    .empty-sub { color: var(--text-3); font-size: 13px; margin-top: 4px; }

    .items-list { display: flex; flex-direction: column; gap: 8px; }
    .item-card {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 14px; padding: 14px; backdrop-filter: blur(12px);
      display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; gap: 8px;
    }
    .item-nom { color: var(--text-1); font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .item-type-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 6px;
      background: rgba(253,203,110,.15); color: #fdcb6e; text-transform: uppercase;
      letter-spacing: .4px;
    }
    .item-modifie-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      background: rgba(0,184,148,.15); color: var(--accent);
    }
    .item-modifie-badge mat-icon { font-size: 11px; width: 11px; height: 11px; }
    .item-prix { color: var(--text-3); font-size: 12px; margin-top: 2px; }
    .item-controls { display: flex; align-items: center; gap: 6px; grid-column: 1; grid-row: 2; }
    .item-subtotal {
      color: var(--accent); font-size: 15px; font-weight: 700;
      grid-column: 2; grid-row: 1 / 3; display: flex; align-items: center; justify-content: flex-end; gap: 4px;
      cursor: pointer; border-radius: 8px; padding: 4px 6px; transition: background .15s;
    }
    .item-subtotal:hover { background: rgba(0,184,148,.08); }
    .edit-prix-icon { font-size: 13px; width: 13px; height: 13px; opacity: .55; }
    .item-subtotal-edit {
      grid-column: 2; grid-row: 1 / 3; display: flex; align-items: center; justify-content: flex-end; gap: 4px;
    }
    .prix-edit-input {
      width: 82px; text-align: right; background: var(--navy); border: 1px solid var(--accent);
      border-radius: 8px; color: var(--text-1); padding: 6px 8px; font-size: 14px; font-weight: 700;
    }
    .prix-edit-fcfa { color: var(--text-3); font-size: 12px; }
    .prix-edit-hint {
      display: flex; align-items: flex-start; gap: 6px;
      color: var(--text-3); font-size: 11px; margin: 2px 2px 0; line-height: 1.4;
    }
    .prix-edit-hint mat-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; }
    .ctrl-btn {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--navy-border);
      background: rgba(255,255,255,.06); color: var(--text-2);
      display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: background .2s;
    }
    .ctrl-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .ctrl-btn:hover { background: rgba(255,255,255,.12); }
    .ctrl-btn.accent { background: var(--accent-lite); border-color: rgba(0,184,148,.3); color: var(--accent); }
    .ctrl-btn.danger { background: rgba(225,112,85,.1); border-color: rgba(225,112,85,.3); color: var(--danger); }
    .item-qty { color: var(--text-1); font-size: 15px; font-weight: 700; min-width: 24px; text-align: center; }

    /* Footer */
    .panier-footer {
      background: var(--navy-card); border: 1px solid var(--navy-border);
      border-radius: 16px; padding: 16px; backdrop-filter: blur(12px);
    }
    .total-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--navy-border);
    }
    .total-label { color: var(--text-2); font-size: 14px; font-weight: 600; }
    .total-value { color: var(--text-1); font-size: 22px; font-weight: 700; }

    /* Mode paiement */
    .paiement-section { margin-bottom: 16px; }
    .paiement-label { color: var(--text-3); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; }
    .paiement-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .mode-btn {
      position: relative;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 12px 8px 10px; border-radius: 12px; cursor: pointer;
      border: 1.5px solid var(--navy-border);
      background: rgba(255,255,255,.03);
      color: var(--text-2); transition: all .15s;
    }
    .mode-btn:hover { background: rgba(255,255,255,.07); }
    .mode-btn.selected {
      border-color: var(--accent);
      background: var(--accent-lite);
    }
    .mode-logo { display: flex; align-items: center; justify-content: center; }
    .mode-logo svg { width: 44px; height: 32px; border-radius: 6px; }
    .mode-name { font-size: 12px; font-weight: 600; }
    .mode-check {
      position: absolute; top: 6px; right: 6px;
      font-size: 14px; width: 14px; height: 14px;
      color: var(--accent);
    }

    .credit-section {
      background: rgba(225,112,85,.08);
      border: 1px solid rgba(225,112,85,.25);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .credit-label { display: block; color: var(--text-2); font-size: 12px; font-weight: 600; margin-bottom: 6px; }
    .credit-input {
      width: 100%; background: var(--navy); border: 1px solid var(--navy-border);
      border-radius: 8px; color: var(--text-1); padding: 10px 12px; font-size: 14px;
    }
    .credit-hint {
      display: flex; align-items: flex-start; gap: 6px;
      color: var(--text-3); font-size: 11px; margin-top: 8px; line-height: 1.4;
    }
    .credit-hint mat-icon { font-size: 15px; width: 15px; height: 15px; flex-shrink: 0; margin-top: 1px; }

    .validate-btn {
      width: 100%; padding: 14px; background: var(--accent); color: #fff;
      border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      cursor: pointer; transition: opacity .2s;
    }
    .validate-btn:disabled { opacity: .6; cursor: not-allowed; }
    .validate-btn mat-icon { font-size: 20px; }
    .offline-msg { display: flex; align-items: center; gap: 6px; color: var(--warning); font-size: 12px; margin-top: 10px; }
    .error-msg { display: flex; align-items: center; gap: 6px; color: var(--danger); font-size: 12px; margin-top: 10px; }
    .offline-msg mat-icon, .error-msg mat-icon { font-size: 16px; }

    .confirm-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 200; backdrop-filter: blur(2px);
      /* Marge de sécurité tout autour + jamais plus haut que le viewport
         réellement visible (iPhone 6/7 et autres petits écrans, barre du
         navigateur mobile qui rogne parfois le bas d'un panneau ancré en
         bas — un centrage avec limite de hauteur + défilement interne est
         beaucoup plus robuste qu'une feuille collée en bas). */
      padding: 16px;
      box-sizing: border-box;
    }
    .confirm-sheet {
      width: 100%; max-width: 420px; background: var(--navy-light);
      border: 1px solid var(--navy-border); border-radius: 20px;
      padding: 24px 20px;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      animation: confirm-pop .18s ease-out;
      max-height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    @keyframes confirm-pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .confirm-icon { font-size: 34px; width: 34px; height: 34px; color: var(--accent); margin-bottom: 4px; }
    .confirm-titre { font-size: 17px; font-weight: 700; color: var(--text-1); margin-bottom: 10px; }
    .confirm-lignes {
      width: 100%; max-height: 160px; overflow-y: auto; -webkit-overflow-scrolling: touch;
      display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;
    }
    .confirm-ligne {
      display: flex; justify-content: space-between; font-size: 13px;
      color: var(--text-2); padding: 4px 2px;
    }
    .confirm-total {
      width: 100%; display: flex; justify-content: space-between; align-items: center;
      padding: 10px 0; border-top: 1px dashed var(--navy-border); margin-top: 4px;
      font-size: 14px; font-weight: 600; color: var(--text-1);
    }
    .confirm-total-valeur { font-size: 20px; font-weight: 800; color: var(--accent); }
    .confirm-mode {
      width: 100%; display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--text-2); margin-bottom: 16px;
    }
    .confirm-mode mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .confirm-actions { width: 100%; display: flex; gap: 10px; }
    .confirm-non, .confirm-oui {
      flex: 1; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
    }
    .confirm-non { background: transparent; border: 1px solid var(--navy-border); color: var(--text-2); }
    .confirm-oui { background: var(--accent); border: none; color: #fff; }
    .confirm-oui mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class PanierComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  total = 0;
  isSaving = false;
  errorMessage = '';
  offlineMsg = '';
  modePaiement: ModePaiement = 'especes';
  clientNom = '';
  cleEnEdition: string | null = null;
  prixEditValeur: number | null = null;
  showConfirmation = false;
  private destroy$ = new Subject<void>();

  // Vente à crédit : nom du client obligatoire (sinon le backend refuse la vente,
  // impossible de créer/retrouver sa fiche sans nom). Tous les autres modes n'ont
  // pas cette contrainte.
  get peutValider(): boolean {
    if (this.modePaiement === 'credit') return this.clientNom.trim().length > 0;
    return true;
  }

  private readonly _rawModes: { value: ModePaiement; label: string; svg: string }[] = [
    {
      value: 'especes', label: 'Espèces',
      svg: `<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="46" height="30" rx="4" fill="#166534" stroke="#4ade80" stroke-width="1.5"/>
        <ellipse cx="24" cy="16" rx="7" ry="7" fill="#4ade80" opacity=".25"/>
        <text x="24" y="21" text-anchor="middle" fill="#4ade80" font-size="11" font-weight="bold" font-family="sans-serif">FCFA</text>
        <rect x="4" y="4" width="7" height="5" rx="1" fill="#4ade80" opacity=".4"/>
        <rect x="37" y="23" width="7" height="5" rx="1" fill="#4ade80" opacity=".4"/>
      </svg>`
    },
    {
      value: 'wave', label: 'Wave',
      svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="10" fill="#5BC8F5"/>
        <!-- Corps -->
        <ellipse cx="24" cy="30" rx="10" ry="12" fill="#1a1a1a"/>
        <!-- Ventre blanc -->
        <ellipse cx="24" cy="32" rx="6" ry="8" fill="white"/>
        <!-- Tête -->
        <ellipse cx="24" cy="17" rx="8" ry="8" fill="#1a1a1a"/>
        <!-- Yeux -->
        <circle cx="21" cy="15" r="1.5" fill="white"/>
        <circle cx="27" cy="15" r="1.5" fill="white"/>
        <!-- Bec -->
        <ellipse cx="24" cy="19.5" rx="2.5" ry="1.5" fill="#F5A623"/>
        <!-- Bras gauche levé -->
        <ellipse cx="13" cy="22" rx="3" ry="6" fill="#1a1a1a" transform="rotate(-40 13 22)"/>
        <!-- Bras droit -->
        <ellipse cx="35" cy="26" rx="3" ry="5" fill="#1a1a1a" transform="rotate(15 35 26)"/>
        <!-- Pattes -->
        <ellipse cx="20" cy="43" rx="4" ry="2.5" fill="#F5A623"/>
        <ellipse cx="28" cy="43" rx="4" ry="2.5" fill="#F5A623"/>
        <!-- Texte wave -->
        <text x="24" y="52" text-anchor="middle" fill="white" font-size="7" font-weight="bold" font-family="sans-serif">wave</text>
      </svg>`
    },
    {
      value: 'orange_money', label: 'Orange Money',
      svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="10" fill="white"/>
        <!-- Flèche noire ↗ -->
        <path d="M10 32 L28 10 L36 10 L36 18 L16 38 Z" fill="#1a1a1a"/>
        <polygon points="26,8 38,8 38,20" fill="#1a1a1a"/>
        <!-- Flèche orange ↙ -->
        <path d="M38 16 L20 38 L12 38 L12 30 L32 10 Z" fill="#FF6B00" opacity="0"/>
        <path d="M22 10 L38 28 L30 38 L12 22 Z" fill="none"/>
        <!-- Version simplifiée : deux flèches propres -->
        <g transform="translate(4,4)">
          <!-- Flèche noire haut-droite -->
          <path d="M4 28 L20 8 L28 8 L28 16 L14 32 Z" fill="#1a1a1a"/>
          <path d="M18 6 L30 6 L30 18 L26 14 L14 26 L10 22 L22 10 Z" fill="#1a1a1a"/>
          <!-- Flèche orange bas-gauche -->
          <path d="M36 12 L20 32 L12 32 L12 24 L26 8 Z" fill="none"/>
          <path d="M22 34 L10 34 L10 22 L14 26 L26 14 L30 18 L18 30 Z" fill="#FF6B00"/>
        </g>
      </svg>`
    },
    {
      value: 'free_money', label: 'Free Money',
      svg: `<svg viewBox="0 0 80 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="48" rx="10" fill="white"/>
        <!-- "free" en rouge italique -->
        <text x="40" y="24" text-anchor="middle" fill="#E30613" font-size="18" font-weight="bold" font-style="italic" font-family="Georgia,serif">free</text>
        <!-- Trait rouge souligné -->
        <line x1="12" y1="29" x2="68" y2="29" stroke="#E30613" stroke-width="2.5"/>
        <!-- "MONEY" en gris foncé -->
        <text x="40" y="42" text-anchor="middle" fill="#333333" font-size="11" font-weight="bold" font-family="Arial,sans-serif" letter-spacing="2">MONEY</text>
      </svg>`
    },
    {
      value: 'credit', label: 'Crédit',
      svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="10" fill="#2d3748"/>
        <rect x="8" y="14" width="32" height="22" rx="3" fill="#e17055"/>
        <rect x="8" y="19" width="32" height="4" fill="#2d3748"/>
        <rect x="12" y="27" width="10" height="4" rx="1" fill="#fff" opacity=".85"/>
      </svg>`
    },
  ];

  get modeLabel(): string {
    const m = this._rawModes.find(mo => mo.value === this.modePaiement);
    if (!m) return this.i18n.lang() === 'ar' ? 'نقداً' : 'Espèces';
    return this.labelFor(m);
  }

  labelFor(m: { value: ModePaiement; label: string }): string {
    if (m.value === 'credit') return this.i18n.t('panier.credit');
    if (m.value === 'especes' && this.i18n.lang() === 'ar') return 'نقداً';
    return m.label;
  }

  readonly modes: { value: ModePaiement; label: string; svg: SafeHtml }[];
  constructor(private pos: PosService, private router: Router, sanitizer: DomSanitizer, public i18n: I18nService) {
    this.modes = this._rawModes.map(m => ({ ...m, svg: sanitizer.bypassSecurityTrustHtml(m.svg) }));
  }

  ngOnInit(): void {
    this.pos.cart$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      this.items = items;
      this.total = this.pos.getTotal();
    });
  }

  increment(item: CartItem): void { this.pos.addToCart(item.produit, item.typeVente); }
  decrement(item: CartItem): void { this.pos.decrementItem(item.produit._id, item.typeVente); }
  remove(item: CartItem): void    { this.pos.removeItem(item.produit._id, item.typeVente); }

  /** Clé unique de ligne (même logique que PosService.cleLigne, dupliquée
   * ici volontairement car privée côté service — un même produit peut avoir
   * 2 lignes distinctes détail/gros). */
  ligneCle(item: CartItem): string {
    return `${item.produit?._id}::${item.typeVente}`;
  }

  /** Le prix de cette ligne diffère-t-il du prix catalogue (détail ou gros
   * selon le type de vente choisi) ? Sert juste à afficher le badge crayon,
   * aucune incidence sur le calcul. */
  estPrixModifie(item: CartItem): boolean {
    const prixCatalogue = item.typeVente === 'gros'
      ? Number(item.produit?.prixGros) || Number(item.produit?.prix) || 0
      : Number(item.produit?.prix) || 0;
    return item.prix !== prixCatalogue;
  }

  ouvrirEditionPrix(item: CartItem): void {
    this.cleEnEdition = this.ligneCle(item);
    // On édite le TOTAL de la ligne (plus parlant pour un agent : "ce lot de
    // 3 coûte 100F" plutôt que "33,33F l'unité") — reconverti en prix
    // unitaire à la validation.
    this.prixEditValeur = Math.round(item.prix * item.quantite);
  }

  validerEditionPrix(item: CartItem): void {
    if (this.cleEnEdition !== this.ligneCle(item)) return;
    this.cleEnEdition = null;
    const total = this.prixEditValeur;
    this.prixEditValeur = null;
    if (total === null || !Number.isFinite(total) || total < 0) return;
    const prixUnitaire = item.quantite > 0 ? total / item.quantite : total;
    this.pos.updateItemPrice(item.produit._id, item.typeVente, prixUnitaire);
  }

  /** Étape 1 : vérifie juste que la vente est valide (ex : nom client pour
   * le crédit) et ouvre la feuille de confirmation avec le total affiché —
   * la vente n'est PAS encore enregistrée à ce stade. */
  demanderConfirmation(): void {
    if (!this.peutValider) {
      this.errorMessage = this.i18n.t('panier.nomClientRequis');
      return;
    }
    this.errorMessage = '';
    this.showConfirmation = true;
  }

  /** Étape 2 : l'agent a confirmé sur la feuille — on enregistre réellement
   * la vente maintenant. */
  confirmerEtValider(): void {
    this.showConfirmation = false;
    this.errorMessage = '';
    this.offlineMsg = '';
    this.isSaving = true;
    this.pos.validateSaleAsync(this.modePaiement, this.clientNom.trim())
      .then((mode) => {
        this.isSaving = false;
        this.clientNom = '';
        if (mode === 'offline') {
          this.offlineMsg = this.i18n.t('panier.offline');
          setTimeout(() => this.router.navigate(['/agent/ticket']), 1800);
        } else {
          this.router.navigate(['/agent/ticket']);
        }
      })
      .catch((err) => {
        this.isSaving = false;
        this.errorMessage = err?.message || (this.i18n.lang() === 'ar' ? 'تعذّر تأكيد عملية البيع' : 'Impossible de valider la vente');
      });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
