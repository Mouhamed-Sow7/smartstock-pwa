# SmartStock Frontend — État courant

> Ce fichier remplace le "prompt de reprise" copié-collé à chaque session.
> **Toute IA (Claude, Copilot, Cline...) qui reprend ce projet doit lire ce fichier + `ARCHITECTURE.md` + `AUTH-FLOW.md` avant de commencer.**
> Historique détaillé des fixes → voir `CHANGELOG.md` (ne pas charger sauf besoin d'investiguer une régression).

**Dernière mise à jour** : 2026-08-15 — dernier commit `be0bfd7`

---

## Contexte business

Client réel en production sur `smartstock.digitalesf.com`. Toute modif à impact large = prudence, pas de régression.

## Infra active

- Frontend : Vercel, domaine **`smartstock.digitalesf.com`** (nouveau domaine de prod). L'ancien `smartstock-pwa-cyan.vercel.app` reste actif en alias.
- Backend : Render, `smartstock-nhmt.onrender.com`
- ⚠️ **Piège infra à ne jamais oublier** : tout changement de domaine/sous-domaine côté frontend doit être ajouté à la whitelist `originesAutorisees` dans `server.js` (backend), sinon échec CORS silencieux (visible seulement en Console DevTools). Dernier ajout : `7df4f5c`.

## Bugs ouverts

_Aucun bug bloquant connu actuellement côté frontend._

## Tâches en attente (non bloquantes)

1. **Thème lié au compte, pas au localStorage seul** — pas commencé. Nécessite : champ `theme` sur le modèle `User` (backend), endpoint de mise à jour, adapter `ThemeService` pour lire/écrire via l'API en plus du cache local (garder le cache pour la dispo offline, backend = source de vérité).
2. **⏳ À confirmer visuellement par l'utilisateur sur `smartstock.digitalesf.com`** (déployé, commit `be0bfd7` — impossible à tester en sandbox, pas de build) :
   - **Session à retaper à chaque ouverture de la PWA installée, résolu** : ce n'était pas un problème d'expiration de token (JWT valide 7j, déjà en localStorage) mais une route par défaut (`''`) qui redirigeait TOUJOURS vers `/login` sans jamais vérifier si une session valide existait déjà. Nouveau `guestGuard` sur `/login`/`/register` : redirige direct vers `/patron` ou `/agent` si un token valide est présent. À tester : fermer complètement la PWA installée puis la rouvrir dans les 7 jours suivant la dernière connexion → doit arriver directement sur le dashboard, sans repasser par le formulaire.
   - **Notif de fin de sync ajoutée** : un snackbar (vert/teal si tout est passé, rouge si des éléments sont en erreur) s'affiche désormais à la fin d'une synchronisation offline→online (ventes/produits/stocks en attente). À tester : faire une vente en mode offline (DevTools → throttling → offline), revenir en ligne, vérifier qu'un toast de confirmation apparaît une fois la sync terminée.
   - Régression détectée puis corrigée le même jour (`51ab39d`) : suite au retrait de `theme.set('dark')`, le formulaire de login devenait un rectangle blanc illisible en thème clair. Cause : `.form-card`/`.hero-badge` matchaient par accident des sélecteurs génériques `[class*="card"]`/`[class*="badge"]` du thème clair. Corrigé.
   - ⚠️ **Piège à surveiller pour toute nouvelle classe ajoutée au login (ou ailleurs)** : `styles.scss` a plusieurs sélecteurs génériques par sous-chaîne (`[class*="card"]`, `[class*="Card"]`, `[class*="badge"]`, `[class*="Badge"]`) qui s'appliquent à toute classe contenant ces mots, même par coïncidence de nommage.
   - Cause racine du thème toujours sombre (précédent, `aefc766`) : `login.component.ts` appelait `this.theme.set('dark')` à chaque passage sur `/login`, écrasant silencieusement le thème clair sauvegardé pour toute l'app. Retiré.
   - Modal produit (création/édition) : largeur corrigée (`width:100%; max-width:540px`) — plus d'espace vide à gauche sur mobile. Fond moins transparent (`--dlg-bg` dédié) pour la lisibilité.
   - Bandeau sync : animation de l'icône remplacée (fondu seul, cadence ralentie) — moins "saccadée".
   - Item historique : rendu du bandeau offline/sync dédupliqué (fix `d104c7d`, toujours à confirmer visuellement en conditions réelles hors ligne).

## Pièges déjà creusés — ne pas rouvrir sauf nouveau signal clair

- **"Les changements ne s'affichent jamais"** : longue investigation (service worker figé ? mauvais domaine Vercel ?). Conclusion : déploiement Vercel vérifié OK, cause = cache navigateur/service worker tenace au moment du test. Considérer le déploiement Vercel comme fiable. Détails → `CHANGELOG.md`.
- **"L'app démarre en sombre"** : NE PAS réinvestiguer côté cache/service worker/anti-FOUC — cause racine trouvée et corrigée (voir ci-dessus, `login.component.ts`). Si le problème persiste après confirmation utilisateur, vérifier d'abord si `localStorage.ss_theme` contient encore `'dark'` dans le navigateur de test (résidu d'avant le fix) avant de rouvrir une investigation.

## Convention de travail (résumé — détail complet dans `.github/copilot-instructions.md`)

- `git pull --rebase` avant toute édition (autres personnes poussent en parallèle).
- Pas de `node_modules` dans le sandbox IA → relecture manuelle + vérif syntaxique systématique après chaque édition.
- Commits en français, détaillés, expliquant la **cause racine**, pas juste le symptôme.
- Utilisateur non-développeur mais technique et exigeant : explications claires, pas de jargon non expliqué, pas de sur-vulgarisation.
- Tout changement touchant l'infra (domaine, DNS, CORS, env vars) → vérifier frontend ET backend systématiquement.

## Comment mettre à jour ce fichier

En fin de session, avant de committer : déplacer les items résolus vers `CHANGELOG.md` (avec le commit hash et la cause racine), garder cette section "Bugs ouverts" / "Tâches en attente" à jour, mettre à jour la ligne "Dernière mise à jour" en haut.
