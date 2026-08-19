import { Injectable, signal } from '@angular/core';

// Persiste la préférence "Scan rapide" comme ThemeService persiste le thème
// clair/sombre : un réglage utilisateur qui doit survivre à la fermeture de
// l'app et être partagé par toutes les pages de scan, pas un simple état de
// composant qui se réinitialiserait à chaque visite de l'écran.
@Injectable({ providedIn: 'root' })
export class ScanModeService {
  private readonly KEY = 'ss_scan_rapide';
  rapide = signal(false);

  constructor() {
    this.rapide.set(localStorage.getItem(this.KEY) === '1');
  }

  toggle(): void {
    this.set(!this.rapide());
  }

  set(actif: boolean): void {
    this.rapide.set(actif);
    localStorage.setItem(this.KEY, actif ? '1' : '0');
  }
}
