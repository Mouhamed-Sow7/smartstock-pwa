import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'ss_theme';
  isDark = signal(true);

  constructor() {
    const saved = localStorage.getItem(this.KEY) as Theme | null;
    // Clair par défaut pour tout nouvel utilisateur (pas de préférence
    // enregistrée) — on ne suit plus prefers-color-scheme, qui faisait
    // souvent démarrer l'app en sombre selon le réglage système du téléphone.
    const initial: Theme = saved ?? 'light';
    this.apply(initial);
  }

  toggle(): void {
    this.apply(this.isDark() ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.apply(theme);
  }

  private apply(theme: Theme): void {
    const html = document.documentElement;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
      this.isDark.set(false);
    } else {
      html.removeAttribute('data-theme');
      this.isDark.set(true);
    }
    localStorage.setItem(this.KEY, theme);
  }
}
