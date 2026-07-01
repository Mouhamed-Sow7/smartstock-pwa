# SmartStock — Flow de connexion & identifiants

> Document de référence mis à jour — reflète l'état du système au 27/06/2026.

---

## 1. Vue d'ensemble des 3 espaces

| Espace | URL | Méthode d'auth | Session |
|---|---|---|---|
| **Admin** (exploitant) | `/admin` | Clé admin (header `x-admin-key`) | `sessionStorage` — expire à la fermeture de l'onglet |
| **Patron** | `/patron/...` | Email + mot de passe | JWT 7 jours |
| **Agent** | `/agent/...` | Email **ou** téléphone + mot de passe | JWT 7 jours |

Tous les comptes patron et agent sont dans la **même collection MongoDB `User`**, différenciés par `role: 'patron' | 'agent'`.

---

## 2. Accès Admin (exploitant / superadmin)

**URL :** `https://smartstock-pwa-cyan.vercel.app/admin`

**Clé admin :**
```
smartstock-admin-2024
```
> Si la variable d'environnement `ADMIN_SECRET_KEY` est définie sur Render, c'est elle qui prime.

**Ce que l'admin peut faire :** voir tous les patrons, créer/modifier/supprimer des comptes, réinitialiser les mots de passe, voir l'équipe complète de chaque boutique (patron + agents), purger les ventes de test.

---

## 3. Comptes démo

| Rôle | Email | Mot de passe | tenantId |
|---|---|---|---|
| Patron | `patron@demo.com` | `demo123` | `demo-tenant` |
| Agent | `agent@demo.com` | `demo123` | `demo-tenant` |

**Recréer les comptes démo** (si supprimés ou mots de passe oubliés) :
```
POST https://smartstock-nhmt.onrender.com/api/auth/demo
```
Aucun body, aucun token — supprime et recrée les deux comptes avec `demo123`.

---

## 4. Inscription d'un nouveau patron

**Endpoint :** `POST /api/auth/register`
```json
{ "email": "patron@maboutique.com", "password": "monmotdepasse", "nom": "Mon Nom" }
```

- `role` est automatiquement `patron`
- `tenantId` unique généré côté serveur (jamais fourni par le client)
- Retourne un JWT directement — connexion automatique après inscription

---

## 5. Connexion (même endpoint pour patron et agent)

**Endpoint :** `POST /api/auth/login`

**Par email :**
```json
{ "email": "...", "password": "..." }
```

**Par téléphone (agents) :**
```json
{ "telephone": "77 123 45 67", "password": "..." }
```

### Normalisation téléphone (transparente)
Le numéro est normalisé automatiquement avant la recherche en base. Tous ces formats sont équivalents :
- `"77 123 45 67"`
- `"221 77 123 45 67"`
- `"+221771234567"`
- `"0771234567"`

L'agent peut taper son numéro dans n'importe quel format — ça matche toujours.

**Préfixes valides au Sénégal :** 70, 75, 76, 77, 78.

**Réponse :**
```json
{
  "token": "...",
  "user": { "id", "email", "nom", "prenom", "role", "tenantId", "boutique", "boutiqueId" }
}
```

Le frontend redirige vers `/patron/dashboard` ou `/agent/dashboard` selon `role`.

---

## 6. Création d'un agent (système multi-boutiques)

Le patron crée d'abord une **boutique** (point de vente), puis des **agents** dans cette boutique.

### 6.1 Créer une boutique
```
POST /api/boutiques
{ "nom": "Boutique Centre-ville", "adresse": "...", "telephone": "..." }
```
→ Un `slug` unique est généré automatiquement depuis le nom (`boutique-centre-ville`).

### 6.2 Créer un agent
```
POST /api/boutiques/:boutiqueId/agents
{ "nom": "Diop", "prenom": "Awa", "telephone": "77 123 45 67" }
```

**Ce que le système génère automatiquement :**

| Champ | Valeur générée |
|---|---|
| Email | `awa.diop@boutique-centre-ville.sm` (si email déjà pris, suffixe aléatoire) |
| Mot de passe | **Aléatoire, 9 caractères** (lettres + chiffres, sans caractères ambigus) |
| tenantId | Hérité du patron connecté |
| boutiqueId | L'ID de la boutique |

**Le mot de passe est affiché une seule fois** dans l'interface au moment de la création, dans une carte "identifiants" copiable. Il n'est jamais envoyé par email ou SMS automatiquement — **le patron doit le transmettre à l'agent**.

> ⚠️ Le numéro de téléphone n'est **jamais** utilisé comme mot de passe. Il sert uniquement d'identifiant de connexion alternatif (à la place de l'email).

### 6.3 Réinitialiser le mot de passe d'un agent
```
PATCH /api/boutiques/agents/:agentId/reset-password
```
Aucun body requis. Le système génère un nouveau mot de passe aléatoire et l'affiche dans l'interface (même carte copiable que lors de la création).

### 6.4 Autres actions sur un agent
| Action | Endpoint |
|---|---|
| Activer/désactiver | `PATCH /api/boutiques/agents/:id/toggle` |
| Supprimer | `DELETE /api/boutiques/agents/:id` |
| Lister les agents d'une boutique | `GET /api/boutiques/:boutiqueId/agents` |

---

## 7. Changer son propre mot de passe (agent connecté)

Un agent peut changer son mot de passe lui-même sans passer par le patron :
```
PATCH /api/auth/change-password
Authorization: Bearer <token>
{ "ancienMotDePasse": "...", "nouveauMotDePasse": "..." }
```

---

## 8. Schéma User — champs clés

```js
{
  email:      String,   // unique — identifiant principal
  telephone:  String,   // stocké normalisé (ex: "221771234567") — identifiant alternatif
  password:   String,   // hashé bcrypt automatiquement (jamais stocké en clair)
  nom:        String,
  prenom:     String,   // agents
  boutique:   String,   // label affiché dans l'UI
  boutiqueId: ObjectId, // lien vers la boutique (agents uniquement)
  role:       'patron' | 'agent',
  tenantId:   String,   // espace du patron — TOUJOURS généré serveur, jamais client
  actif:      Boolean,  // false = bloque la connexion immédiatement
}
```

**Règle de sécurité fondamentale :** `tenantId` n'est jamais accepté dans le body d'une requête cliente. Il vient soit de `crypto.randomUUID()` (inscription patron), soit de `req.tenantId` extrait du JWT (pour tout ce qu'un patron crée ensuite).

---

## 9. Tableau récapitulatif rapide

```
┌──────────────┬─────────────────────────┬──────────────────────────┬─────────────────────────┐
│ Rôle         │ Où se connecter          │ Identifiant              │ Mot de passe            │
├──────────────┼─────────────────────────┼──────────────────────────┼─────────────────────────┤
│ Admin        │ /admin                  │ (pas de compte — clé)    │ clé admin               │
│ Patron démo  │ /login                  │ patron@demo.com          │ demo123                 │
│ Agent démo   │ /login                  │ agent@demo.com           │ demo123                 │
│ Nouveau patron│ /login → "Créer compte"│ email au choix           │ au choix                │
│ Nouvel agent  │ créé par le patron      │ email@slug.sm OU tél     │ généré auto (9 car.)    │
│              │ depuis /patron/agents   │                          │ affiché une seule fois  │
└──────────────┴─────────────────────────┴──────────────────────────┴─────────────────────────┘
```
