import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SyncService } from './core/services/sync.service';

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
  }
}
