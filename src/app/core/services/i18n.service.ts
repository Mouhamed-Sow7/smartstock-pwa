import { Injectable, signal } from '@angular/core';

export type Lang = 'fr' | 'ar';

// Dictionnaire plat clé -> { fr, ar }. Portée actuelle : parcours agent
// uniquement (scan, panier, ticket, dashboard agent, historique, menu agent) —
// voir demande utilisateur du 2026-08-17. Patron/login/register restent en
// français pour l'instant, à étendre dans une prochaine itération.
const DICT: Record<string, { fr: string; ar: string }> = {
  // Navigation agent (bottom-nav + topbar)
  'nav.scanner': { fr: 'Scanner', ar: 'مسح' },
  'nav.panier': { fr: 'Panier', ar: 'السلة' },
  'nav.historique': { fr: 'Historique', ar: 'السجل' },
  'nav.dashboard': { fr: 'Accueil', ar: 'الرئيسية' },
  'nav.deconnexion': { fr: 'Déconnexion', ar: 'تسجيل الخروج' },
  'nav.langue': { fr: 'Langue', ar: 'اللغة' },

  // Dashboard agent
  'dash.bonjour': { fr: 'Bonjour', ar: 'مرحباً' },
  'dash.ventesAujourdhui': { fr: "Ventes aujourd'hui", ar: 'مبيعات اليوم' },
  'dash.montantAujourdhui': { fr: "Montant aujourd'hui", ar: 'المبلغ اليوم' },
  'dash.dernieresVentes': { fr: 'Dernières ventes', ar: 'آخر المبيعات' },
  'dash.aucuneVente': { fr: 'Aucune vente pour le moment', ar: 'لا توجد مبيعات حتى الآن' },
  'dash.commencerVente': { fr: 'Commencer une vente', ar: 'ابدأ عملية بيع' },
  'dash.voirTout': { fr: 'Voir tout', ar: 'عرض الكل' },

  // Scan (écran principal de vente)
  'scan.titre': { fr: 'Scanner un produit', ar: 'مسح منتج' },
  'scan.viser': { fr: 'Visez le code-barres', ar: 'وجّه الكاميرا نحو الباركود' },
  'scan.rechercheManuelle': { fr: 'Recherche manuelle', ar: 'بحث يدوي' },
  'scan.produitIntrouvable': { fr: 'Produit introuvable', ar: 'المنتج غير موجود' },
  'scan.creerProduit': { fr: 'Créer ce produit', ar: 'إنشاء هذا المنتج' },
  'scan.modifierProduit': { fr: 'Modifier ce produit', ar: 'تعديل هذا المنتج' },
  'scan.ajouteAuPanier': { fr: 'Ajouté au panier', ar: 'أُضيف إلى السلة' },
  'scan.scanRapide': { fr: 'Scan rapide', ar: 'مسح سريع' },
  'scan.detail': { fr: 'Détail', ar: 'بالتفصيل' },
  'scan.gros': { fr: 'Gros', ar: 'بالجملة' },
  'scan.choisirTypeVente': { fr: 'Choisissez le type de vente', ar: 'اختر نوع البيع' },
  'scan.stockInsuffisant': { fr: 'Stock insuffisant', ar: 'المخزون غير كافٍ' },
  'scan.perime': { fr: 'Produit périmé', ar: 'منتج منتهي الصلاحية' },
  'scan.expireBientot': { fr: 'Expire bientôt', ar: 'ستنتهي صلاحيته قريباً' },

  // Panier / validation de vente
  'panier.titre': { fr: 'Panier', ar: 'السلة' },
  'panier.articles': { fr: 'article(s)', ar: 'منتج (منتجات)' },
  'panier.vide': { fr: 'Panier vide', ar: 'السلة فارغة' },
  'panier.videSub': { fr: 'Scannez un produit pour commencer', ar: 'امسح منتجاً للبدء' },
  'panier.unite': { fr: 'unité', ar: 'وحدة' },
  'panier.total': { fr: 'Total', ar: 'المجموع' },
  'panier.modePaiement': { fr: 'Mode de paiement', ar: 'طريقة الدفع' },
  'panier.valider': { fr: 'Valider', ar: 'تأكيد' },
  'panier.validation': { fr: 'Validation...', ar: 'جارٍ التأكيد...' },
  'panier.offline': {
    fr: 'Vente sauvegardée hors ligne — synchronisation automatique',
    ar: 'تم حفظ البيع دون اتصال — سيتم المزامنة تلقائياً',
  },
  'panier.nomClient': { fr: 'Nom du client', ar: 'اسم الزبون' },
  'panier.nomClientPlaceholder': { fr: 'Ex : Fatou Diop', ar: 'مثال: فاطو ديوب' },
  'panier.credit': { fr: 'Crédit', ar: 'دين' },
  'panier.nomClientRequis': { fr: 'Le nom du client est requis pour une vente à crédit', ar: 'اسم الزبون مطلوب لعملية بيع بالدين' },

  // Ticket
  'ticket.titre': { fr: 'Ticket de vente', ar: 'إيصال البيع' },
  'ticket.imprimer': { fr: 'Imprimer', ar: 'طباعة' },
  'ticket.nouvelleVente': { fr: 'Nouvelle vente', ar: 'عملية بيع جديدة' },
  'ticket.merci': { fr: 'Merci pour votre achat', ar: 'شكراً على شرائكم' },

  // Historique agent
  'hist.titre': { fr: 'Historique de mes ventes', ar: 'سجل مبيعاتي' },
  'hist.aucuneVente': { fr: 'Aucune vente sur cette période', ar: 'لا توجد مبيعات في هذه الفترة' },
  'hist.aujourdhui': { fr: "Aujourd'hui", ar: 'اليوم' },
  'hist.semaine': { fr: 'Semaine', ar: 'الأسبوع' },
  'hist.mois': { fr: 'Mois', ar: 'الشهر' },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly KEY = 'ss_lang';
  lang = signal<Lang>('fr');

  constructor() {
    const saved = localStorage.getItem(this.KEY) as Lang | null;
    this.apply(saved ?? 'fr');
  }

  toggle(): void {
    this.apply(this.lang() === 'fr' ? 'ar' : 'fr');
  }

  setLang(lang: Lang): void {
    this.apply(lang);
  }

  /** Traduit une clé ; si absente du dictionnaire ou pour la langue courante,
   *  retombe sur le français puis sur la clé elle-même (jamais d'écran vide). */
  t(key: string): string {
    const entry = DICT[key];
    if (!entry) return key;
    return entry[this.lang()] ?? entry.fr ?? key;
  }

  private apply(lang: Lang): void {
    // Le dir="rtl" n'est PAS posé ici sur <html> globalement : la traduction
    // ne couvre pour l'instant que le parcours agent (voir DICT ci-dessus),
    // et le login/patron ne sont pas prêts pour du RTL (mise en page fixe,
    // pas de logique de miroir). Le dir est appliqué localement par
    // AgentLayoutComponent sur son propre conteneur racine via [attr.dir],
    // pour ne jamais fuiter vers l'écran de login au moment de la
    // déconnexion. Seul le lang (metadata, sans effet de mise en page) est
    // posé globalement ici, pour l'accessibilité/lecteurs d'écran.
    document.documentElement.setAttribute('lang', lang === 'ar' ? 'ar' : 'fr');
    this.lang.set(lang);
    localStorage.setItem(this.KEY, lang);
  }
}
