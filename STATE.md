# SmartStock Frontend — État courant

> Ce fichier remplace le "prompt de reprise" copié-collé à chaque session.
> **Toute IA (Claude, Copilot, Cline...) qui reprend ce projet doit lire ce fichier + `ARCHITECTURE.md` + `AUTH-FLOW.md` avant de commencer.**
> Historique détaillé des fixes → voir `CHANGELOG.md` (ne pas charger sauf besoin d'investiguer une régression).

**Dernière mise à jour** : 2026-08-15 — dernier commit `51ab39d`

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
2. **⏳ À confirmer visuellement par l'utilisateur sur `smartstock.digitalesf.com`** (déployé, commit `51ab39d` — impossible à tester en sandbox, pas de build) :
   - **Régression détectée puis corrigée le même jour** : suite au retrait de `theme.set('dark')` (voir ci-dessous), le formulaire de login devenait un rectangle blanc illisible en thème clair. Cause : `.form-card` et `.hero-badge` (classes du template login) matchent par accident les sélecteurs génériques `[class*="card"]` / `[class*="badge"]` du thème clair (destinés aux cartes/badges du reste de l'app), qui posent des couleurs littérales en `!important` — la protection "login toujours sombre" existante ne réinitialise que des *variables* CSS, donc ne pouvait pas bloquer ça. Fix `51ab39d` : exclusion explicite de `app-login` de ces deux sélecteurs génériques.
   - ⚠️ **Piège à surveiller pour toute nouvelle classe ajoutée au login (ou ailleurs)** : `styles.scss` a plusieurs sélecteurs génériques par sous-chaîne (`[class*="card"]`, `[class*="Card"]`, `[class*="badge"]`, `[class*="Badge"]`) qui s'appliquent à toute classe contenant ces mots, même par coïncidence de nommage. Si un futur bug de style "clair" bizarre apparaît sur un composant dont le nom de classe contient "card"/"badge" (ou variantes), regarder ces règles en premier.
   - Cause racine du thème toujours sombre (précédent) : `login.component.ts` appelait `this.theme.set('dark')` à chaque passage sur `/login` (connexion ET déconnexion), écrasant silencieusement le thème clair sauvegardé pour toute l'app. Retiré (`aefc766`) — la page login est 100% codée en dur en sombre, ce `set()` n'avait aucun effet visuel sur elle, il ne servait qu'à casser le reste de l'app.
   - Modal produit (création/édition) : largeur corrigée (`width:100%; max-width:540px` au lieu de `min(540px,96vw)`, à la fois en CSS et dans la config `MatDialog`) — plus d'espace vide à gauche sur mobile.
   - Modal produit : fond moins transparent (`--dlg-bg` dédié, quasi-opaque en sombre) pour la lisibilité — scopé au composant, `--navy-card` global inchangé ailleurs.
   - Bandeau sync : animation de l'icône remplacée (fondu seul au lieu de opacity+scale, cadence ralentie) — moins "saccadée".
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
