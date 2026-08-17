import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

// "Prêt client" = vente à crédit dont le solde n'est pas encore remboursé.
// Volontairement pas de notion d'échéance/relance ici : le patron voit un
// simple todo (remboursé / non remboursé), coche quand le client a payé, et
// c'est tout — aucune notification n'est jamais envoyée au client.
export interface ClientCredit {
  _id: string;
  nom: string;
  telephone: string;
  soldeDu: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ClientsService {
  // Nombre de clients avec un prêt non remboursé — alimente le badge sur
  // l'onglet "Prêts" de la bottom-nav patron.
  readonly pretsNonRembourses = signal<number>(0);
  readonly clientsCredit = signal<ClientCredit[]>([]);

  constructor(private api: ApiService) {}

  // Recharge la liste complète des clients (remboursés + non remboursés) :
  // c'est la base de la todo-list "Prêts". On ne se limite plus aux clients
  // proches d'une échéance — le patron doit voir tout le monde.
  async rafraichirCredits(): Promise<void> {
    try {
      const res: any = await firstValueFrom(this.api.get('clients'));
      const liste: ClientCredit[] = res?.data || [];
      this.clientsCredit.set(liste);
      this.pretsNonRembourses.set(liste.filter((c) => c.soldeDu > 0).length);
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
}
