import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { SyncService } from './core/services/sync.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('smartstock-pwa');

  constructor(public sync: SyncService, private swUpdate: SwUpdate) {}

  ngOnInit(): void {
    this.sync.rafraichirCompteur();
    this.reveillerBackend();
    this.surveillerNouvelleVersion();
  }

  /**
   * Detecte une nouvelle version deployee (nouveau commit/build) et l'active
   * immediatement + recharge la page. Sans ca, le Service Worker continue de
   * servir indefiniment l'ancien bundle JS en cache, meme apres un F5 normal
   * -> les correctifs pousses semblent "ne jamais s'appliquer" alors qu'ils
   * sont bien deployes. C'etait la cause racine de plusieurs faux-negatifs
   * de test sur cette app.
   */
  private surveillerNouvelleVersion(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        this.swUpdate.activateUpdate().then(() => document.location.reload());
      });

    // Verifie aussi activement au demarrage (au cas ou le SW n'a pas encore
    // detecte de nouvelle version par lui-meme depuis le dernier deploiement).
    this.swUpdate.checkForUpdate().catch(() => {});
  }

  /** Ping fire-and-forget au démarrage pour réveiller Render (cold-start free tier) avant que l'utilisateur n'agisse. */
  private reveillerBackend(): void {
    const baseUrl = environment.apiUrl.replace(/\/api\/?$/, '');
    fetch(`${baseUrl}/ping`).catch(() => {
      // Silencieux : si ça échoue, le retry dans SyncService gérera le cold-start au moment de la vente.
    });
  }
}
