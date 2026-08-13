import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AbonnementStatus {
  prochainPaiement: string;
  joursRestants: number;
  statut: 'ok' | 'a_venir' | 'en_retard';
  alerte: boolean;
}

@Injectable({ providedIn: 'root' })
export class AbonnementService {
  private baseUrl = `${environment.apiUrl}/auth`;

  // null tant que non chargé : le bandeau ne s'affiche jamais avant d'avoir
  // une vraie réponse, pour éviter un flash "abonnement en retard" au
  // démarrage de l'app pendant le chargement.
  readonly statut = signal<AbonnementStatus | null>(null);
  readonly bandeauFerme = signal(false);

  constructor(private http: HttpClient) {}

  async rafraichir(): Promise<void> {
    try {
      const res: any = await firstValueFrom(this.http.get(`${this.baseUrl}/abonnement`));
      this.statut.set(res?.data || null);
    } catch {
      // Silencieux : hors ligne, on ne montre rien plutôt qu'une fausse alerte
    }
  }

  fermerBandeau(): void {
    this.bandeauFerme.set(true);
  }
}
