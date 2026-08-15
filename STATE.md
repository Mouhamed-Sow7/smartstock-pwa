# SmartStock Frontend — État courant

> Ce fichier remplace le "prompt de reprise" copié-collé à chaque session.
> **Toute IA (Claude, Copilot, Cline...) qui reprend ce projet doit lire ce fichier + `ARCHITECTURE.md` + `AUTH-FLOW.md` avant de commencer.**
> Historique détaillé des fixes → voir `CHANGELOG.md` (ne pas charger sauf besoin d'investiguer une régression).

**Dernière mise à jour** : 2026-08-15 — dernier commit `d104c7d`

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
2. **⏳ À confirmer visuellement par l'utilisateur sur `smartstock.digitalesf.com`** (impossible à tester en sandbox — pas de build) :
   - Fix `d104c7d` : script anti-FOUC dans `index.html` censé supprimer le flash sombre au démarrage/refresh (cause racine : `ThemeService` ne s'instanciait qu'au premier composant l'injectant, donc après le premier paint).
   - Fix `d104c7d` : retrait du bandeau offline/sync dupliqué dans `app.html` (ancien design orange/rotation, empilé avec celui — correct — des layouts patron/agent). À vérifier qu'un seul bandeau (teal/pulse) s'affiche désormais en mode hors ligne ou en sync sur les pages patron/agent.
   - Reste aussi à confirmer : rendu du thème clair par défaut lui-même (item historique, probablement déjà bon mais jamais formellement confirmé depuis le fix CORS `7df4f5c`).

## Pièges déjà creusés — ne pas rouvrir sauf nouveau signal clair

- **"Les changements ne s'affichent jamais"** : longue investigation (service worker figé ? mauvais domaine Vercel ?). Conclusion : déploiement Vercel vérifié OK, cause = cache navigateur/service worker tenace au moment du test. Considérer le déploiement Vercel comme fiable. Détails → `CHANGELOG.md`.

## Convention de travail (résumé — détail complet dans `.github/copilot-instructions.md`)

- `git pull --rebase` avant toute édition (autres personnes poussent en parallèle).
- Pas de `node_modules` dans le sandbox IA → relecture manuelle + vérif syntaxique systématique après chaque édition.
- Commits en français, détaillés, expliquant la **cause racine**, pas juste le symptôme.
- Utilisateur non-développeur mais technique et exigeant : explications claires, pas de jargon non expliqué, pas de sur-vulgarisation.
- Tout changement touchant l'infra (domaine, DNS, CORS, env vars) → vérifier frontend ET backend systématiquement.

## Comment mettre à jour ce fichier

En fin de session, avant de committer : déplacer les items résolus vers `CHANGELOG.md` (avec le commit hash et la cause racine), garder cette section "Bugs ouverts" / "Tâches en attente" à jour, mettre à jour la ligne "Dernière mise à jour" en haut.
