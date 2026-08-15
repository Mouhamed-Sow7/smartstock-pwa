# SmartStock Frontend — État courant

> Ce fichier remplace le "prompt de reprise" copié-collé à chaque session.
> **Toute IA (Claude, Copilot, Cline...) qui reprend ce projet doit lire ce fichier + `ARCHITECTURE.md` + `AUTH-FLOW.md` avant de commencer.**
> Historique détaillé des fixes → voir `CHANGELOG.md` (ne pas charger sauf besoin d'investiguer une régression).

**Dernière mise à jour** : 2026-08-15 — dernier commit `8c447f5`

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
2. **Confirmation utilisateur en attente** : le nouveau bandeau offline/sync (couleurs thème teal + pulsation douce) et le thème clair par défaut doivent être re-vérifiés visuellement sur `smartstock.digitalesf.com` — le dernier retour utilisateur datait d'avant le fix CORS (`7df4f5c`), donc pas encore confirmé.

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
