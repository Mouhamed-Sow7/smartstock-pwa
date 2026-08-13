import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface ClientRelance {
  _id: string;
  nom: string;
  telephone: string;
  soldeDu: number;
  prochaineEcheance: string;
  joursRestants: number;
  statut: 'a_venir' | 'en_retard';
}

@Injectable({ providedIn: 'root' })
export class ClientsService {
  // Nombre de clients à relancer (échéance <= 3j ou en retard) — alimente le
  // badge sur l'onglet Clients de la bottom-nav, patron et agent.
  readonly relancesCount = signal<number>(0);
  readonly relances = signal<ClientRelance[]>([]);

  constructor(private api: ApiService) {}

  async rafraichirRelances(): Promise<void> {
    try {
      const res: any = await firstValueFrom(this.api.get('clients/relances'));
      const liste: ClientRelance[] = res?.data || [];
      this.relances.set(liste);
      this.relancesCount.set(liste.length);
    } catch {
      // Silencieux : hors ligne ou erreur réseau, le badge garde sa dernière
      // valeur connue plutôt que de clignoter à 0.
    }
  }

  getClients() {
    return this.api.get('clients');
  }

  getClient(id: string) {
    return this.api.get(`clients/${id}`);
  }

  creerClient(nom: string, telephone?: string) {
    return this.api.post('clients', { nom, telephone });
  }

  enregistrerPaiement(clientId: string, montant: number, note?: string) {
    return this.api.post(`clients/${clientId}/paiement`, { montant, note });
  }

  definirEcheance(clientId: string, date: Date | null) {
    return this.api.patch(`clients/${clientId}/echeance`, { date });
  }
}
