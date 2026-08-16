# SmartStock Frontend — État courant

> Ce fichier remplace le "prompt de reprise" copié-collé à chaque session.
> **Toute IA (Claude, Copilot, Cline...) qui reprend ce projet doit lire ce fichier + `ARCHITECTURE.md` + `AUTH-FLOW.md` avant de commencer.**
> Historique détaillé des fixes → voir `CHANGELOG.md` (ne pas charger sauf besoin d'investiguer une régression).

**Dernière mise à jour** : 2026-08-15 — dernier commit `cc1dbdc`

---

## Contexte business

Client réel en production sur `smartstock.digitalesf.com`. Toute modif à impact large = prudence, pas de régression.

## Infra active

- Frontend : Vercel, domaine **`smartstock.digitalesf.com`**. L'ancien `smartstock-pwa-cyan.vercel.app` reste actif en alias.
- Backend : Render, `smartstock-nhmt.onrender.com` — ⚠️ Vercel poste un statut de déploiement sur GitHub (vérifiable par une IA via l'API), **Render non** : impossible de confirmer un déploiement backend depuis une session IA sans accès direct au dashboard. Toujours demander confirmation à l'utilisateur après un push sur `smartStock`.
- ⚠️ **Piège CORS** : tout changement de domaine/sous-domaine frontend → ajouter à `originesAutorisees` dans `server.js` (backend).

## ⚠️ Point d'architecture transversal — app zoneless

**L'app tourne sans `zone.js`** (absent de `package.json` ET `angular.json` — confirmé). Muter un champ de classe classique depuis un contexte async (callback `subscribe()`, `.then()`, `setTimeout`...) ne déclenche PAS de rafraîchissement automatique de la vue — seul un `signal()` (`.set()`) ou un appel explicite à `ChangeDetectorRef.markForCheck()` le fait. Deux bugs de cette session (spinner login bloqué, nom de boutique non rafraîchi) avaient cette cause. **Si un futur bug ressemble à "l'UI ne se met pas à jour tant qu'on ne clique pas/qu'on ne navigue pas ailleurs", vérifier en premier si l'état concerné est un `signal()`.** Pas d'audit systématique fait sur le reste de l'app.

## Bugs ouverts

_Aucun bug bloquant connu actuellement côté frontend._

## Backlog priorisé par l'utilisateur (2026-08-15)

1. ✅ **Login par téléphone patron** — corrigé (backend `smartStock` `7999339`). ⚠️ Un patron déjà inscrit sans téléphone en base devra l'ajouter — pas encore de moyen (voir point 3).
2. ✅ **Propagation renommage boutique** (admin → patron/agent/ticket client) — corrigé : cascade backend (`smartStock` `7999339`) + `AuthService.refreshUser()` frontend (`cc1dbdc`). Collection `Boutique` (système multi-outlet séparé) volontairement non cascadée — risque de casser un patron multi-enseignes, à traiter séparément si besoin exprimé.
3. **⏳ Pas commencé — mot de passe généré par admin pour patron + changement d'email patron en libre-service**
   - Un endpoint `PATCH /admin/users/:id/reset-password` existe déjà côté backend (`admin.controller.js`), déjà utilisé pour les agents (dropdown "Équipe" côté admin). À vérifier/exposer dans l'UI admin pour un **patron** (semble scopé aux agents seulement actuellement).
   - Aucune page "mon compte" patron côté frontend : pas de moyen pour un patron de changer son email/téléphone lui-même. À construire — nécessaire aussi pour le point 1 (patrons sans téléphone).
4. **⏳ Pas commencé, priorité la plus basse — email de récupération de mot de passe**
   Adresses dispo : `contact@digitalesf.com` / `noreply@digitalesf.com`, sender gratuit à choisir. Nécessite Nodemailer + provider (Brevo/SendGrid free tier) côté backend. En attente que 1-3 soient terminés.
5. **⏳ À confirmer par l'utilisateur (déployé, commit `cc1dbdc`)** :
   - Spinner login bloqué jusqu'à un clic — cause zoneless, corrigé.
   - Notif de fin de sync : l'utilisateur a signalé ne pas l'avoir vue lors d'un test réel — possible qu'il ait testé avant le déploiement du fix (ajouté le même jour). À reconfirmer.

## Pièges déjà creusés — ne pas rouvrir sauf nouveau signal clair

- **"Les changements ne s'affichent jamais"** (ancien) : cache navigateur/service worker, pas un problème de déploiement Vercel. Détails → `CHANGELOG.md`.
- **"L'app démarre en sombre"** : cause trouvée et corrigée (`login.component.ts` forçait `theme.set('dark')` à chaque login, commit `aefc766`). Si ça revient, vérifier `localStorage.ss_theme` avant de rouvrir une investigation.
- **"L'UI ne se met pas à jour / reste bloquée"** : voir la section zoneless ci-dessus AVANT toute autre piste — déjà arrivé deux fois cette session pour cette raison exacte.

## Convention de travail (résumé — détail complet dans `.github/copilot-instructions.md`)

- `git pull --rebase` avant toute édition (autres personnes/sessions poussent en parallèle).
- Pas de `node_modules` dans le sandbox IA → relecture manuelle + vérif syntaxique systématique après chaque édition.
- Commits en français, détaillés, expliquant la **cause racine**, pas juste le symptôme.
- Utilisateur non-développeur mais technique et exigeant : explications claires, pas de jargon non expliqué, pas de sur-vulgarisation.
- Tout changement touchant l'infra (domaine, DNS, CORS, env vars) → vérifier frontend ET backend systématiquement.
- Attention aux backticks dans les messages de commit passés via `git commit -m "..."` en double quotes bash — ils sont interprétés comme de la substitution de commande. Utiliser un fichier temporaire (`git commit -F fichier.txt`) pour les messages détaillés contenant des backticks.

## Comment mettre à jour ce fichier

En fin de session, avant de committer : déplacer les items résolus vers `CHANGELOG.md` (avec le commit hash et la cause racine), garder "Bugs ouverts"/"Backlog priorisé" à jour, mettre à jour la ligne "Dernière mise à jour" en haut.
