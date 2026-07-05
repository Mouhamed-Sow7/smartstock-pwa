import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'ss_theme';
  isDark = signal(true);

  constructor() {
    const saved = localStorage.getItem(this.KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = saved ?? (prefersDark ? 'dark' : 'light');
    this.apply(initial);
  }

  toggle(): void {
    this.apply(this.isDark() ? 'light' : 'dark');
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
