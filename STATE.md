# SmartStock Frontend — État courant

> Ce fichier remplace le "prompt de reprise" copié-collé à chaque session.
> **Toute IA (Claude, Copilot, Cline...) qui reprend ce projet doit lire ce fichier + `ARCHITECTURE.md` + `AUTH-FLOW.md` avant de commencer.**
> Historique détaillé des fixes → voir `CHANGELOG.md` (ne pas charger sauf besoin d'investiguer une régression).

**Dernière mise à jour** : 2026-08-17 — dernier commit `aab628c`

---

## Contexte business

Client réel en production sur `smartstock.digitalesf.com`. Toute modif à impact large = prudence, pas de régression.

## Infra active

- Frontend : Vercel, domaine **`smartstock.digitalesf.com`**. L'ancien `smartstock-pwa-cyan.vercel.app` reste actif en alias.
- Backend : Render, `smartstock-nhmt.onrender.com` — ⚠️ Vercel poste un statut de déploiement sur GitHub (vérifiable par une IA via l'API), **Render non**. Toujours demander confirmation à l'utilisateur après un push sur `smartStock`.
- ⚠️ **Piège CORS** : tout changement de domaine/sous-domaine frontend → ajouter à `originesAutorisees` dans `server.js` (backend).

## ⚠️ Points d'architecture transversaux à connaître avant de coder

1. **App zoneless** (pas de `zone.js`, confirmé absent de `package.json`/`angular.json`). Muter un champ de classe classique depuis un callback async (`subscribe()`, `.then()`...) ne rafraîchit PAS la vue automatiquement — utiliser `signal()` (`.set()`) ou `ChangeDetectorRef.markForCheck()` explicitement. Plusieurs bugs de cette session avaient cette cause (spinner login, nom de boutique non rafraîchi). **Pas d'audit systématique fait sur tout le reste de l'app.**
2. **Vérification de build Vercel obligatoire après toute modif d'un fichier avec interfaces TypeScript strictes** (ex: `admin.component.ts`). `node -c` ne détecte QUE la syntaxe JS basique, PAS les erreurs de typage Angular (variable utilisée dans un template mais absente de son interface) — ces erreurs cassent le build silencieusement (aucune erreur locale, seul le build réel le révèle). Deux commits de cette session (`1fb25b8`, `2cc95d4`) ont cassé le build de cette façon avant d'être détectés et corrigés (`98b3890`). **Toujours vérifier le statut du commit via l'API GitHub après un push touchant ce type de fichier, pas seulement en fin de série de commits.**
3. **Deux règles CSS globales `[class*="card"]`/`[class*="badge"]`** dans `styles.scss` (thème clair) s'appliquent à TOUTE classe contenant ces mots, même par coïncidence de nommage (a déjà cassé le login une fois : `.form-card`/`.hero-badge`). Si un futur bug de style clair bizarre apparaît sur un composant dont une classe contient "card"/"badge", regarder ça en premier.

## Bugs ouverts

_Aucun bug bloquant connu actuellement._

## Backlog — demandes utilisateur en attente (2026-08-17)

1. **⏳ Rôles admin à clarifier/étendre** — l'utilisateur a mentionné vouloir un système équivalent pour les rôles admin, à préciser avec lui (pas de detail fourni au-delà de "pareil pour admin et ses rôles comme décrit en haut" — probablement lié à la gestion des patrons/abonnements, à reclarifier en début de prochaine session).
2. **⏳ Carte "crédit" à la validation de vente** — demande initiale : ajouter une carte "crédit" au moment de valider une vente, pour enregistrer un prêt/crédit client. **Le système de crédit existe déjà côté backend** (modèles `Client`/`Paiement`, `modePaiement:'credit'` sur `Vente`, page `/patron/relances`) — pas encore vérifié si le flux de VALIDATION DE VENTE (POS agent) propose déjà cette option ou si l'UI manque. À investiguer en priorité avant de coder quoi que ce soit.
3. **⏳ Date de création abonnement "via le réseau au Sénégal"** — demande de l'utilisateur de s'assurer que la date d'inscription d'un patron est fiable pour déclencher les rappels d'abonnement. Investigation faite : Sénégal = UTC+0 (pas de DST), donc pas de vrai problème de fuseau horaire technique ; `prochainPaiementAbonnement` est déjà posé automatiquement (+30j) via le schéma Mongoose dès l'inscription — **automatique, pas d'action requise**, sauf si l'utilisateur clarifie un besoin différent.
4. **⏳ Email de récupération de mot de passe** — priorité la plus basse (déjà notée avant). Adresses dispo : `contact@digitalesf.com`/`noreply@digitalesf.com`. Nécessite Nodemailer + provider SMTP gratuit (Brevo/SendGrid) côté backend.

## Résolu le 2026-08-17

- Page "Mon compte" patron branchée : route `/patron/compte` ajoutée à `patron.module.ts`, lien d'accès en icône `account_circle` dans la topbar du `patron-layout.component.ts` (pas dans la bottom-nav, grille figée à 5 colonnes). Aucun changement backend nécessaire, endpoints `PATCH /auth/profil` et `PATCH /auth/change-password` déjà en place et vérifiés. Commit `aab628c`, build Vercel vérifié OK.

## Résolu cette session (2026-08-15 → 2026-08-16), pour référence rapide

- Login par téléphone patron (bloqué avant, backend filtrait sur role:'agent')
- Propagation renommage boutique → patron/agents/ticket client (cascade + `refreshUser()`)
- Spinner login bloqué (cause zoneless), session PWA qui redemandait toujours les identifiants (route `''` sans vérif de session), notif de fin de sync manquante
- Modal création agent : badge "inactif" jusqu'à reload (réponse backend incomplète), fermeture accidentelle au clic extérieur
- Agents : téléphone comme SEUL identifiant désormais (plus d'email généré) — rétrocompatible avec les agents créés avant
- Admin ne voyait aucun agent d'un patron (mauvaise URL `/team/:id` au lieu de `/tenants/:id/team`)
- Modification d'un agent (nom/tél/reset mdp) tapait dans un système legacy à QR code complètement différent (collection vide) → "Erreur de modification" à chaque tentative — nouvel endpoint `PATCH /boutiques/agents/:agentId` créé, URL frontend corrigée
- Régénération de mot de passe seule (sans changer nom/tél) : confirmée fonctionnelle par l'utilisateur
- Page inscription (register) mise en sombre permanent, comme le login
- Vue "Tous les abonnés" ajoutée à l'onglet Abonnements admin (pas seulement ceux à relancer)
- 2 régressions de build Vercel (interface TS incomplète) détectées et corrigées le jour même

## Pièges déjà creusés — ne pas rouvrir sauf nouveau signal clair

- **"Les changements ne s'affichent jamais"** (ancien, pré-2026-08-15) : cache navigateur/service worker, pas un problème de déploiement Vercel.
- **"L'app démarre en sombre"** : cause trouvée et corrigée (`login.component.ts` forçait `theme.set('dark')` à chaque login, commit `aefc766`).
- **"L'UI ne se met pas à jour / reste bloquée"** : voir point d'architecture zoneless ci-dessus AVANT toute autre piste.
- **PAT exposés dans cette conversation à de très nombreuses reprises** (session très longue) — voir section sécurité du prompt de migration. À révoquer et régénérer dès que possible.

## Convention de travail (résumé — détail complet dans `.github/copilot-instructions.md`)

- `git pull --rebase` avant toute édition.
- Vérif syntaxique (`node -c` équivalent Python pour TS, ou juste relecture) après chaque édition — **mais ça ne suffit pas** pour les erreurs de typage Angular, voir point d'architecture #2.
- Commits en français, détaillés, cause racine expliquée.
- Utilisateur non-développeur mais technique et exigeant.
- Tout changement infra (domaine, DNS, CORS, env vars) → vérifier frontend ET backend.
- Backticks dans les messages de commit passés via `git commit -m "..."` en bash double-quotes → interprétés comme substitution de commande. Utiliser `git commit -F fichier.txt`.
- Après un push touchant potentiellement le typage TS (surtout `admin.component.ts`), attendre ~45s puis vérifier le statut via l'API GitHub avant de considérer le fix comme déployé.

## Comment mettre à jour ce fichier

En fin de session : déplacer les items résolus vers `CHANGELOG.md` (commit hash + cause racine), garder "Bugs ouverts"/"Backlog" à jour, mettre à jour la date en haut.
