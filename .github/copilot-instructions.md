# Instructions pour agents IA (Copilot, Claude, Cline...)

Ce fichier est lu automatiquement par GitHub Copilot Chat au début de chaque conversation dans ce repo.
Pour toute autre IA (Claude, Cline...) : lire ce fichier explicitement avant de commencer.

## Avant de commencer une tâche

1. Lire `STATE.md` (état courant : bugs ouverts, tâches en attente, piège infra actif).
2. Lire `ARCHITECTURE.md` (stack, structure des dossiers, endpoints API).
3. Si la tâche touche l'authentification : lire aussi `AUTH-FLOW.md`.
4. `git pull --rebase` avant toute édition — d'autres personnes/sessions poussent en parallèle sur ce repo.
5. Ne PAS charger `CHANGELOG.md` sauf besoin explicite d'investiguer une régression ou comprendre une décision passée.

## Contraintes projet

- **Client réel en production** sur `smartstock.digitalesf.com`. Priorité absolue à la stabilité — pas de régression, prudence sur tout changement à impact large.
- Multi-tenant : toute donnée est scopée par `tenantId`. Ne jamais oublier ce filtre dans une requête ou un cache Dexie.
- Offline-first : les entités créées hors ligne ont un id temporaire `temp_xxx` jusqu'à sync réussie. Toute nouvelle fonctionnalité touchant les ventes/produits/stocks doit gérer ce cas (voir le bug `8c447f5` dans `CHANGELOG.md` pour un exemple de piège classique).
- CORS backend : whitelist stricte par origine exacte (`originesAutorisees` dans `server.js` du repo backend `smartStock`), pas de wildcard. Tout changement de domaine/sous-domaine côté frontend doit être répercuté côté backend.

## Style de code et de commit attendu

- Commits en français, détaillés, expliquant la **cause racine** du bug (pas juste le symptôme) — l'utilisateur aime comprendre le "pourquoi".
- Vérifier l'équilibre des accolades/parenthèses après chaque édition (relecture manuelle systématique, pas de build possible en sandbox).
- Utilisateur non-développeur mais technique et exigeant : explications claires, sans jargon non expliqué, sans sur-vulgarisation non plus.

## En fin de session

Mettre à jour `STATE.md` : déplacer les items résolus vers `CHANGELOG.md` (avec commit hash + cause racine), garder les sections "Bugs ouverts" / "Tâches en attente" à jour.

## Repo lié

Le backend correspondant est `Mouhamed-Sow7/smartStock` (Node/Express/MongoDB, déployé sur Render). Toute modif infra (domaine, CORS, variables d'env) doit être vérifiée des deux côtés.
