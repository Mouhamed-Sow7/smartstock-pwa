import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';

export interface Vente {
  _id: string;
  numeroTicket: string;
  agentNom: string;
  produits: { nom: string; quantite: number; prixUnitaire: number; sousTotal: number }[];
  montantTotal: number;
  modePaiement: string;
  statut: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class RapportService {
  constructor(private api: ApiService, private auth: AuthService) {}

  getVentes(debut: string, fin: string): Observable<any> {
    return this.api.get(`ventes?debut=${debut}&fin=${fin}`);
  }

  async exportPDF(ventes: Vente[], label: string, boutique: string): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // En-tête
    doc.setFontSize(18);
    doc.setTextColor(0, 184, 148);
    doc.text(boutique || 'SmartStock', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapport des ventes — ${label}`, 14, 26);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 32);

    // KPIs
    const total = ventes.reduce((s, v) => s + v.montantTotal, 0);
    const nbVentes = ventes.length;
    const panier = nbVentes ? Math.round(total / nbVentes) : 0;

    doc.setFillColor(0, 184, 148);
    doc.roundedRect(14, 38, 55, 18, 3, 3, 'F');
    doc.roundedRect(74, 38, 55, 18, 3, 3, 'F');
    doc.roundedRect(134, 38, 55, 18, 3, 3, 'F');

    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${total.toLocaleString('fr-FR')} F`, 41, 48, { align: 'center' });
    doc.text(`${nbVentes}`, 101, 48, { align: 'center' });
    doc.text(`${panier.toLocaleString('fr-FR')} F`, 161, 48, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Chiffre d\'affaires', 41, 53, { align: 'center' });
    doc.text('Nb ventes', 101, 53, { align: 'center' });
    doc.text('Panier moyen', 161, 53, { align: 'center' });

    // Tableau
    const rows = ventes.map(v => [
      new Date(v.createdAt).toLocaleDateString('fr-FR'),
      new Date(v.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      v.numeroTicket,
      v.agentNom,
      v.produits.map(p => `${p.nom} x${p.quantite}`).join(', '),
      v.modePaiement,
      `${v.montantTotal.toLocaleString('fr-FR')} F`,
    ]);

    autoTable(doc, {
      startY: 62,
      head: [['Date', 'Heure', 'Ticket', 'Agent', 'Articles', 'Paiement', 'Total']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 27, 45], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 250, 248] },
      columnStyles: { 4: { cellWidth: 55 }, 6: { halign: 'right', fontStyle: 'bold' } },
    });

    // Pied de page
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} / ${pageCount} — SmartStock`, doc.internal.pageSize.width / 2, 290, { align: 'center' });
    }

    doc.save(`rapport_ventes_${label.replace(/\s/g, '_')}.pdf`);
  }

  async exportExcel(ventes: Vente[], label: string): Promise<void> {
    const XLSX = await import('xlsx');

    const rows = ventes.map(v => ({
      'Date': new Date(v.createdAt).toLocaleDateString('fr-FR'),
      'Heure': new Date(v.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      'Ticket': v.numeroTicket,
      'Agent': v.agentNom,
      'Articles': v.produits.map(p => `${p.nom} (x${p.quantite})`).join(' | '),
      'Nb articles': v.produits.reduce((s, p) => s + p.quantite, 0),
      'Mode paiement': v.modePaiement,
      'Total (FCFA)': v.montantTotal,
      'Statut': v.statut,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventes');

    // Largeurs colonnes
    ws['!cols'] = [
      { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 18 },
      { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 10 },
    ];

    XLSX.writeFile(wb, `rapport_ventes_${label.replace(/\s/g, '_')}.xlsx`);
  }
}
