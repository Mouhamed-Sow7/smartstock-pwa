import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
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

  constructor(public sync: SyncService) {}

  ngOnInit(): void {
    this.sync.rafraichirCompteur();
    this.reveillerBackend();
  }

  /** Ping fire-and-forget au démarrage pour réveiller Render (cold-start free tier) avant que l'utilisateur n'agisse. */
  private reveillerBackend(): void {
    const baseUrl = environment.apiUrl.replace(/\/api\/?$/, '');
    fetch(`${baseUrl}/ping`).catch(() => {
      // Silencieux : si ça échoue, le retry dans SyncService gérera le cold-start au moment de la vente.
    });
  }
}
