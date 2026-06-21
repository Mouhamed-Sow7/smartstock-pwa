import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

export interface Agent {
  _id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: 'agent' | 'caissier' | 'superviseur';
  boutique?: string;
  actif: boolean;
  qrCode?: string;
  createdAt: string;
}

// ─── Dialog Ajout Agent ────────────────────────────────────────────────────
@Component({
  selector: 'app-agent-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>person_add</mat-icon> Nouvel agent
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="agent-form">
        <div class="row">
          <mat-form-field appearance="fill">
            <mat-label>Prénom</mat-label>
            <input matInput formControlName="prenom" placeholder="Prénom" />
            <mat-error *ngIf="form.get('prenom')?.hasError('required')">Requis</mat-error>
          </mat-form-field>
          <mat-form-field appearance="fill">
            <mat-label>Nom</mat-label>
            <input matInput formControlName="nom" placeholder="Nom" />
            <mat-error *ngIf="form.get('nom')?.hasError('required')">Requis</mat-error>
          </mat-form-field>
        </div>
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>Téléphone</mat-label>
          <input matInput formControlName="telephone" placeholder="+221 77..." />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="fill">
            <mat-label>Rôle</mat-label>
            <mat-select formControlName="role">
              <mat-option value="agent">Agent</mat-option>
              <mat-option value="caissier">Caissier</mat-option>
              <mat-option value="superviseur">Superviseur</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="fill">
            <mat-label>Boutique</mat-label>
            <input matInput formControlName="boutique" placeholder="Nom boutique" />
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Annuler</button>
      <button mat-raised-button color="primary"
        [disabled]="form.invalid || loading"
        (click)="save()">
        <mat-spinner *ngIf="loading" diameter="18"></mat-spinner>
        <span *ngIf="!loading">Créer</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
    mat-dialog-content { min-width: min(420px, 90vw); padding-top: 12px !important; }
    .agent-form { display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; gap: 12px; }
    .row mat-form-field { flex: 1; }
    .full-width { width: 100%; }
    mat-dialog-actions { padding: 12px 24px !important; gap: 8px; }
    mat-spinner { display: inline-block; }
  `]
})
export class AgentDialogComponent {
  dialogRef = inject(MatDialogRef<AgentDialogComponent>);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  loading = false;
  form = this.fb.group({
    prenom: ['', Validators.required],
    nom: ['', Validators.required],
    telephone: [''],
    role: ['agent', Validators.required],
    boutique: [''],
  });

  save() {
    if (this.form.invalid) return;
    this.loading = true;
    this.api.post('agents', this.form.value).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.dialogRef.close(res.data);
      },
      error: () => { this.loading = false; }
    });
  }
}

// ─── Dialog QR Code ────────────────────────────────────────────────────────
@Component({
  selector: 'app-qr-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>qr_code_2</mat-icon> QR Code — {{ data.prenom }} {{ data.nom }}
    </h2>
    <mat-dialog-content class="qr-content">
      <div class="qr-wrapper" *ngIf="!loading && qrSrc">
        <img [src]="qrSrc" alt="QR Code" />
        <p class="qr-hint">L'agent scanne ce code pour s'identifier à la caisse.</p>
      </div>
      <div class="qr-loading" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
      <div class="qr-error" *ngIf="!loading && !qrSrc">
        <mat-icon>error_outline</mat-icon>
        <p>Impossible de charger le QR code.</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Fermer</button>
      <a *ngIf="qrSrc" [href]="qrSrc" [download]="data.prenom + '_' + data.nom + '_qr.png'"
        mat-stroked-button color="primary">
        <mat-icon>download</mat-icon> Télécharger
      </a>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
    .qr-content { display: flex; justify-content: center; padding: 16px 24px !important; }
    .qr-wrapper { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .qr-wrapper img { width: 220px; height: 220px; border-radius: 8px; }
    .qr-hint { color: var(--text-2); font-size: 13px; text-align: center; }
    .qr-loading { display: flex; align-items: center; justify-content: center; height: 200px; }
    .qr-error { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--danger); }
    mat-dialog-actions { padding: 12px 24px !important; gap: 8px; }
  `]
})
export class QrDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<QrDialogComponent>);
  data: Agent = inject(MAT_DIALOG_DATA);
  private api = inject(ApiService);

  loading = true;
  qrSrc: string | null = null;

  ngOnInit() {
    this.api.get(`agents/${this.data._id}/qrcode-image`).subscribe({
      next: (res: any) => {
        this.qrSrc = res.qrCode;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}

// ─── Page principale ────────────────────────────────────────────────────────
@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatSlideToggleModule, MatTooltipModule,
    MatDialogModule,
  ],
  template: `
    <div class="agents-page">
      <div class="page-header">
        <h1>Agents</h1>
        <button mat-raised-button color="primary" (click)="openAdd()">
          <mat-icon>person_add</mat-icon> Ajouter
        </button>
      </div>

      <!-- Loading -->
      <div class="loading-center" *ngIf="isLoading()">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <!-- Empty -->
      <div class="empty-state" *ngIf="!isLoading() && agents().length === 0">
        <mat-icon>group_off</mat-icon>
        <p>Aucun agent. Ajoutez votre premier agent.</p>
      </div>

      <!-- Liste -->
      <div class="agents-grid" *ngIf="!isLoading() && agents().length > 0">
        <div class="agent-card" *ngFor="let a of agents()"
          [class.inactif]="!a.actif">
          <div class="agent-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="agent-info">
            <div class="agent-name">{{ a.prenom }} {{ a.nom }}</div>
            <div class="agent-meta">
              <span class="badge-role" [class]="a.role">{{ roleLabel(a.role) }}</span>
              <span class="agent-tel" *ngIf="a.telephone">
                <mat-icon>phone</mat-icon>{{ a.telephone }}
              </span>
              <span class="agent-boutique" *ngIf="a.boutique">
                <mat-icon>store</mat-icon>{{ a.boutique }}
              </span>
            </div>
          </div>
          <div class="agent-actions">
            <mat-slide-toggle
              [checked]="a.actif"
              (change)="toggleActif(a)"
              matTooltip="{{ a.actif ? 'Désactiver' : 'Activer' }}"
              color="primary">
            </mat-slide-toggle>
            <button mat-icon-button matTooltip="Voir QR Code" (click)="showQr(a)">
              <mat-icon>qr_code_2</mat-icon>
            </button>
            <button mat-icon-button color="warn" matTooltip="Supprimer" (click)="deleteAgent(a)">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .agents-page {
      padding: 16px;
      max-width: 900px;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-1);
    }
    .loading-center {
      display: flex;
      justify-content: center;
      padding: 60px 0;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 60px 0;
      color: var(--text-3);
    }
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }
    .agents-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .agent-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: var(--navy-card);
      border: 1px solid var(--navy-border);
      border-radius: 12px;
      transition: opacity .2s;
    }
    .agent-card.inactif {
      opacity: .5;
    }
    .agent-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--accent-lite);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .agent-avatar mat-icon {
      color: var(--accent);
    }
    .agent-info {
      flex: 1;
      min-width: 0;
    }
    .agent-name {
      font-weight: 600;
      font-size: 15px;
      color: var(--text-1);
    }
    .agent-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }
    .badge-role {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }
    .badge-role.agent     { background: var(--accent-lite); color: var(--accent); }
    .badge-role.caissier  { background: rgba(108,92,231,.15); color: #a29bfe; }
    .badge-role.superviseur { background: rgba(241,196,15,.12); color: #f1c40f; }
    .agent-tel, .agent-boutique {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      color: var(--text-2);
    }
    .agent-tel mat-icon, .agent-boutique mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .agent-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
  `]
})
export class AgentsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private destroy$ = new Subject<void>();

  agents = signal<Agent[]>([]);
  isLoading = signal(true);

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  load() {
    this.isLoading.set(true);
    this.api.get('agents').pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.agents.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snack.open('Erreur lors du chargement', 'OK', { duration: 3000 });
      }
    });
  }

  openAdd() {
    this.dialog.open(AgentDialogComponent, { width: '480px' })
      .afterClosed().subscribe((newAgent: Agent) => {
        if (newAgent) {
          this.agents.update(list => [newAgent, ...list]);
          this.snack.open(`${newAgent.prenom} ${newAgent.nom} ajouté ✓`, '', { duration: 2500 });
        }
      });
  }

  showQr(agent: Agent) {
    this.dialog.open(QrDialogComponent, { data: agent, width: '340px' });
  }

  toggleActif(agent: Agent) {
    this.api.patch(`agents/${agent._id}/toggle`, {}).subscribe({
      next: (res: any) => {
        this.agents.update(list =>
          list.map(a => a._id === agent._id ? { ...a, actif: res.data.actif } : a)
        );
        const status = res.data.actif ? 'activé' : 'désactivé';
        this.snack.open(`${agent.prenom} ${status}`, '', { duration: 2000 });
      },
      error: () => this.snack.open('Erreur', 'OK', { duration: 3000 })
    });
  }

  deleteAgent(agent: Agent) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { message: `Supprimer ${agent.prenom} ${agent.nom} ?` }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`agents/${agent._id}`).subscribe({
        next: () => {
          this.agents.update(list => list.filter(a => a._id !== agent._id));
          this.snack.open('Agent supprimé', '', { duration: 2000 });
        },
        error: () => this.snack.open('Erreur lors de la suppression', 'OK', { duration: 3000 })
      });
    });
  }

  roleLabel(role: string): string {
    return { agent: 'Agent', caissier: 'Caissier', superviseur: 'Superviseur' }[role] ?? role;
  }
}
