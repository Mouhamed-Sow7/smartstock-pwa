# SmartStock — Architecture Technique

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Angular 21 (standalone components, Signals) |
| UI | Angular Material 21, Tailwind (utilitaires ponctuels) |
| Backend | Node.js + Express.js |
| Base de données | MongoDB (Mongoose) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Hébergement frontend | Vercel (CI/CD automatique sur push `main`) |
| Hébergement backend | Render (free tier — cold-start ~20-30s après inactivité) |
| PWA | Angular Service Worker (`ngsw-worker.js`) avec `SwUpdate` |
| Offline | Dexie.js (IndexedDB wrapper) — base `SmartStockDB` |

---

## Structure des dossiers

### Backend (`smartStock/`)
```
├── controllers/
│   ├── auth.controller.js       # register, login, createDemoUser, changePassword
│   ├── produit.controller.js    # CRUD produits, alertes stock, scan barcode
│   ├── vente.controller.js      # createVente (identite via JWT), getStats, getVentes
│   ├── agent.controller.js      # QR-code agents (collection separee, sans login)
│   ├── boutique.controller.js   # CRUD boutiques + agents multi-boutiques
│   └── admin.controller.js      # gestion superadmin (cle API)
├── models/
│   ├── user.model.js            # patrons ET agents (meme collection)
│   ├── boutique.model.js        # points de vente multi-boutiques
│   ├── produit.model.js         # catalogue produits
│   └── vente.model.js           # transactions + marge
├── routes/                      # un fichier par domaine
├── middleware/
│   └── auth.middleware.js       # decode JWT -> req.user, req.tenantId
└── utils/
    ├── phone.js                 # normalisation telephone senegalais
    └── password.js              # generateur mot de passe aleatoire lisible
```

### Frontend (`smartstock-pwa/`)
```
src/app/
├── app.ts                       # root component — wake-up ping + SwUpdate
├── core/
│   ├── services/
│   │   ├── api.service.ts       # HTTP wrapper (get/post/patch/delete)
│   │   ├── auth.service.ts      # JWT storage, getUser(), getRole()
│   │   ├── sync.service.ts      # ventes online/offline + retry cold-start
│   │   ├── offline.service.ts   # Dexie (produits, ventes pending)
│   │   └── rapport.service.ts   # export PDF (jsPDF) + Excel (xlsx)
│   └── interceptors/
│       └── jwt.interceptor.ts   # injecte Bearer token sur chaque requete
├── modules/
│   ├── admin/                   # panneau superadmin (cle admin uniquement)
│   ├── auth/login/              # page de connexion / inscription
│   ├── patron/
│   │   ├── dashboard/           # stats CA, marge, ventes par periode
│   │   ├── produits/            # shelf-row, dialog produit (chips categories)
│   │   ├── agents/              # boutiques + agents multi-boutiques
│   │   └── ventes/              # historique ventes, filtres, export PDF/Excel
│   └── agent/
│       ├── scan/                # scanner camera + saisie manuelle + suggestions
│       ├── panier/              # caisse (modes de paiement, validation)
│       ├── ticket/              # ticket de caisse (58mm / 80mm)
│       ├── dashboard/           # stats agent du jour
│       └── historique/          # historique des ventes de l'agent
└── shared/components/           # ConfirmDialog, etc.
```

---

## Modèles de données

### User
```js
{
  email:      String,    // unique, identifiant principal — genere auto pour les agents
  telephone:  String,    // TOUJOURS stocke normalise (ex: "221781440232")
                         // via utils/phone.js — identifiant alternatif agents
  password:   String,    // hash bcrypt (pre-save hook automatique)
  nom:        String,
  prenom:     String,    // agents uniquement
  boutique:   String,    // label affiche dans l'UI
  boutiqueId: ObjectId,  // ref → Boutique (agents uniquement)
  role:       'patron' | 'agent',
  tenantId:   String,    // espace du patron — JAMAIS accepte depuis le client
  actif:      Boolean,   // desactiver = bloque la connexion
}
```

### Boutique
```js
{
  tenantId:    String,   // patron proprietaire
  nom:         String,
  adresse:     String,
  telephone:   String,
  description: String,
  actif:       Boolean,
  slug:        String,   // unique, genere depuis nom — compose les emails agents
                         // ex: "boutique-centre-ville" → agent@boutique-centre-ville.sm
}
```

### Produit
```js
{
  tenantId:    String,   // isolation multi-tenant
  nom:         String,
  prix:        Number,   // prix de vente
  prixAchat:   Number,   // prix d'achat — sert au calcul de marge brute
  stock:       Number,
  seuilAlerte: Number,   // defaut 5 — declanche l'alerte "stock bas"
  categorie:   String,
  codeBarres:  String,   // index unique par tenant (partiel — ignore les vides)
  image:       String,
}
```

### Vente
```js
{
  tenantId:     String,
  agentId:      String,   // User._id de l'agent connecte (identite via JWT)
  agentNom:     String,
  produits: [{            // snapshot complet au moment de la vente
    produitId:          ObjectId,
    nom:                String,   // nom produit au moment de la vente
    prixUnitaire:       Number,   // prix de vente snapshot
    prixAchatUnitaire:  Number,   // prix d'achat snapshot
    quantite:           Number,
    sousTotal:          Number,   // prixUnitaire * quantite
    margeLigne:         Number,   // (prixUnitaire - prixAchatUnitaire) * quantite
  }],
  montantTotal:  Number,          // somme des sousTotaux
  margeTotale:   Number,          // somme des margeLigne = marge brute de la vente
  modePaiement:  'especes' | 'wave' | 'orange_money' | 'mtn' | 'autre',
  statut:        'paye' | 'en_attente' | 'annule',
  numeroTicket:  String,          // TK-AAAAMMJJ-XXXX (unique par jour)
  note:          String,
  createdAt:     Date,            // index — sert pour tous les rapports par periode
}
```

---

## Système multi-tenant

Chaque patron obtient un `tenantId` unique (ex: `tenant_a1b2c3d4`) à l'inscription — **généré exclusivement côté serveur**, jamais accepté depuis le client (sécurité : un client ne peut pas forger un tenantId pour accéder aux données d'un autre patron).

Tout document (Produit, Vente, Boutique, User agent) porte ce `tenantId`. Le middleware `auth.middleware.js` décode le JWT et pose `req.tenantId` — tous les controllers filtrent systématiquement par `{ tenantId: req.tenantId }`.

### Multi-boutiques (nouveau)
Un patron peut créer plusieurs `Boutique` (points de vente). Chaque boutique appartient au même `tenantId` mais a un `slug` unique (ex: `boutique-centre-ville`). Les agents créés dans une boutique reçoivent :
- un email auto-généré : `prenom.nom@slug.sm`
- un mot de passe **aléatoire** généré par `utils/password.js` (affiché une seule fois au patron, jamais stocké en clair)
- `boutiqueId` pour rattachement à la boutique
- `tenantId` hérité du patron — accès complet aux produits et ventes de l'espace

---

## Comptabilité / Marge brute

Le champ `prixAchat` sur chaque `Produit` permet de calculer la marge brute automatiquement à chaque vente :

```
margeLigne = (prixVente - prixAchat) × quantite
margeTotale vente = Σ margeLigne
```

Ces valeurs sont **snapshotées** dans la vente (pas recalculées a posteriori — si le prixAchat change, les ventes passées restent exactes).

La fonction `getStats` (`vente.controller.js`) agrège par période :
- CA aujourd'hui / cette semaine / ce mois / cette année
- Marge brute par période (même granularité)
- Répartition des paiements du mois (espèces / Wave / Orange Money / etc.)
- Les pourcentages de marge sont calculés : `(margeTotale / montantTotal) * 100`

---

## Authentification

### Flow complet
1. **Patron** : `POST /api/auth/register` → tenantId généré → JWT retourné
2. **Agent** : créé par le patron via `POST /api/boutiques/:id/agents` → mot de passe aléatoire généré + affiché une fois
3. **Login** : `POST /api/auth/login` avec `{ email, password }` ou `{ telephone, password }` (téléphone normalisé automatiquement)
4. JWT signé avec `JWT_SECRET` (env var Render), durée 7 jours
5. Intercepteur Angular injecte `Authorization: Bearer <token>` sur chaque requête
6. `auth.middleware.js` vérifie + décode → `req.user`, `req.tenantId`

### Admin (superadmin)
Accès via clé API (`x-admin-key` header), pas de JWT. Clé : variable d'env `ADMIN_SECRET_KEY` (defaut: `smartstock-admin-2024`). URL : `/admin`.

### Normalisation téléphone sénégalais (`utils/phone.js`)
Formats acceptés à l'entrée : `"77 123 45 67"`, `"221 77 123 45 67"`, `"+221771234567"`, `"0771234567"` → tous normalisés vers `"221771234567"`. Préfixes valides : 70, 75, 76, 77, 78.

---

## PWA / Service Worker

Le Service Worker Angular (`ngsw-worker.js`) met en cache tous les assets JS/CSS/HTML. Sans logique de mise à jour, le navigateur servait indéfiniment un bundle périmé malgré les déploiements. Fix en place (`app.ts`) :

```ts
swUpdate.versionUpdates
  .pipe(filter(e => e.type === 'VERSION_READY'))
  .subscribe(() => swUpdate.activateUpdate().then(() => document.location.reload()));
swUpdate.checkForUpdate();
```

Le SW est **désactivé en mode dev** (`isDevMode()`) — `ng serve` utilise toujours le code frais.

### Mode offline (Dexie)
`offline.service.ts` maintient une base IndexedDB (`SmartStockDB`) avec :
- Cache produits (synchronisé au chargement)
- File de ventes `pending` (ventes créées hors-ligne, synchronisées automatiquement au retour réseau)

---

## Endpoints API principaux

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | - | Inscription patron |
| POST | `/api/auth/login` | - | Connexion (email ou téléphone) |
| PATCH | `/api/auth/change-password` | JWT | Agent change son propre mdp |
| POST | `/api/auth/demo` | - | Recrée les comptes démo |
| GET | `/api/produits` | JWT | Liste produits du tenant |
| POST | `/api/produits` | JWT | Créer un produit |
| PATCH | `/api/produits/:id` | JWT | Modifier un produit |
| PATCH | `/api/produits/:id/stock` | JWT | Entrée/sortie de stock |
| DELETE | `/api/produits/:id` | JWT | Supprimer un produit |
| GET | `/api/produits/barcode/:code` | JWT | Chercher par code-barres |
| GET | `/api/produits/alerte` | JWT | Produits en dessous du seuil |
| POST | `/api/ventes` | JWT | Créer une vente (déduit stock) |
| GET | `/api/ventes` | JWT | Historique ventes |
| GET | `/api/ventes/stats` | JWT | Stats CA + marge par période |
| GET | `/api/boutiques` | JWT | Liste boutiques du patron |
| POST | `/api/boutiques` | JWT | Créer une boutique |
| POST | `/api/boutiques/:id/agents` | JWT | Créer un agent dans une boutique |
| PATCH | `/api/boutiques/agents/:id/toggle` | JWT | Activer/désactiver un agent |
| PATCH | `/api/boutiques/agents/:id/reset-password` | JWT | Réinitialiser mdp (génère auto) |
| DELETE | `/api/boutiques/agents/:id` | JWT | Supprimer un agent |
| GET | `/api/admin/stats` | Clé admin | Stats globales toutes boutiques |
| GET | `/api/admin/users` | Clé admin | Liste tous les patrons |
| POST | `/api/admin/users` | Clé admin | Créer un patron manuellement |
| PATCH | `/api/admin/users/:id` | Clé admin | Modifier nom/email/boutique |
| PATCH | `/api/admin/users/:id/toggle` | Clé admin | Activer/désactiver |
| PATCH | `/api/admin/users/:id/reset-password` | Clé admin | Réinitialiser mdp patron |
| DELETE | `/api/admin/ventes` | Clé admin | Purger toutes les ventes (reset test) |
| GET | `/ping` | - | Health check |
