# SmartStock Frontend — État courant

> Ce fichier remplace le "prompt de reprise" copié-collé à chaque session.
> **Toute IA (Claude, Copilot, Cline...) qui reprend ce projet doit lire ce fichier + `ARCHITECTURE.md` + `AUTH-FLOW.md` avant de commencer.**
> Historique détaillé des fixes → voir `CHANGELOG.md` (ne pas charger sauf besoin d'investiguer une régression).

**Dernière mise à jour** : 2026-08-20 — dernier commit `cefebf5`

---

## Contexte business

Client réel en production sur `smartstock.digitalesf.com`. Toute modif à impact large = prudence, pas de régression. **L'utilisateur prévoit de passer sur des plans payants Render + MongoDB Atlas pour faire grandir ce SaaS** (2026-08-20) — voir l'audit sécurité/performance dans le `STATE.md` du repo **backend** (`smartStock`), qui couvre l'essentiel (secrets, index, pagination) ; rien de critique trouvé côté frontend lors de cet audit (pas de secret exposé dans `environment.ts`, apiUrl seule valeur présente).

## Infra active

- Frontend : Vercel, domaine **`smartstock.digitalesf.com`**. L'ancien `smartstock-pwa-cyan.vercel.app` reste actif en alias.
- Backend : Render, `smartstock-nhmt.onrender.com` — ⚠️ Vercel poste un statut de déploiement sur GitHub (vérifiable par une IA via l'API), **Render non**. Toujours demander confirmation à l'utilisateur après un push sur `smartStock`.
- ⚠️ **Piège CORS** : tout changement de domaine/sous-domaine frontend → ajouter à `originesAutorisees` dans `server.js` (backend).
- **Cold-start Render (plan gratuit/basique)** : cause de plusieurs bugs "fausse déconnexion" déjà rencontrés (voir commit `cefebf5`) — le retry x2/8s sur `creerVente`/`creerProduit`/`ajusterStock` limite mais n'élimine pas le symptôme si le réveil dépasse ~17s. Un plan Render payant sans sleep réglerait ça à la racine ; c'est un argument concret en faveur de la montée en gamme envisagée par l'utilisateur.

## ⚠️ Points d'architecture transversaux à connaître avant de coder

1. **App zoneless** (pas de `zone.js`, confirmé absent de `package.json`/`angular.json`). Muter un champ de classe classique depuis un callback async (`subscribe()`, `.then()`...) ne rafraîchit PAS la vue automatiquement — utiliser `signal()` (`.set()`) ou `ChangeDetectorRef.markForCheck()` explicitement. Plusieurs bugs déjà rencontrés avaient cette cause (spinner login, nom de boutique non rafraîchi). **Pas d'audit systématique fait sur tout le reste de l'app.**
2. **Vérification de build Vercel obligatoire après toute modif d'un fichier avec interfaces TypeScript strictes** (ex: `admin.component.ts`). `node -c` ne détecte QUE la syntaxe JS basique, PAS les erreurs de typage Angular (variable utilisée dans un template mais absente de son interface) — ces erreurs cassent le build silencieusement (aucune erreur locale, seul le build réel le révèle). **Toujours vérifier le statut du commit via l'API GitHub après un push, pas seulement en fin de série de commits.**
3. **Deux règles CSS globales `[class*="card"]`/`[class*="badge"]`** dans `styles.scss` (thème clair) s'appliquent à TOUTE classe contenant ces mots, même par coïncidence de nommage (a déjà cassé le login une fois : `.form-card`/`.hero-badge`). Si un futur bug de style clair bizarre apparaît sur un composant dont une classe contient "card"/"badge", regarder ça en premier.
4. **`color-scheme` piloté manuellement** (`styles.scss`, `:root`/`[data-theme="light"]`) pour que le rendu natif du navigateur (icône `<input type="date">`, scrollbars...) suive le thème réel de l'app plutôt que la préférence OS. Si un futur champ natif (date, time, color...) semble mal contrasté dans un thème donné, ce n'est probablement PAS un bug de ce champ précis — vérifier `color-scheme` en premier.
5. **i18n arabe (fusha) sur le parcours agent uniquement** (`core/services/i18n.service.ts`, signal-based maison, pas de librairie externe) depuis le 2026-08-20. Patron/login/register restent en français. `dir="rtl"` appliqué localement sur le conteneur racine d'`agent-layout` uniquement (jamais sur `<html>` globalement), pour ne pas fuiter vers login/patron qui n'ont aucune logique RTL. **Traduction non relue par un locuteur natif** — à valider en usage réel.

## Bugs ouverts

_Aucun bug bloquant connu actuellement._

## Backlog — demandes utilisateur en attente (2026-08-20)

1. **⏳ Toggle FR/EN** — l'utilisateur veut, en plus de l'arabe, un sélecteur français/anglais. Pas encore commencé. Probablement extension du même `I18nService` (ajouter `'en'` à `Lang`, un 3ᵉ jeu de clés au dictionnaire) plutôt qu'un nouveau système.
2. **⏳ Version "quincaillerie"** — SmartStock adapté à la gestion commerciale de quincailleries (pas une traduction, un métier différent : nomenclature produits, unités de mesure, etc. probablement différentes d'une boutique généraliste). Aucun détail précis donné pour l'instant — à clarifier en début de prochaine session avant de coder quoi que ce soit.
3. **⏳ Email de récupération de mot de passe** — priorité la plus basse (déjà notée avant). Adresses dispo : `contact@digitalesf.com`/`noreply@digitalesf.com`. Nécessite Nodemailer + provider SMTP gratuit (Brevo/SendGrid) côté backend.
4. **⏳ Pagination des listes** (ventes, produits, historique...) — voir audit dans le `STATE.md` backend, impact frontend à prévoir (chargement par page) une fois la partie backend traitée. Pas urgent tant que l'historique des tenants reste petit, mais à garder à l'esprit avec la montée en charge prévue.

## Résolu récemment (2026-08-17 → 2026-08-20), pour référence rapide

- Icône date invisible (`color-scheme` désynchronisé du thème réel de l'app, voir point d'architecture #4) + modal produit fermé par erreur au clic extérieur (`disableClose: true` sur les 4 points d'ouverture)
- Traduction arabe (fusha) du parcours agent avec sélecteur FR/AR — voir point d'architecture #5
- Fix date de péremption (et prix de gros) jamais sauvegardés à la création d'un produit — `ProduitService.create()` construisait le payload avec une liste de champs figée en dur, jamais mise à jour avec ces deux champs ajoutés depuis. Corrigé aux deux points d'envoi (création en ligne + hors ligne mise en queue)
- Prix de vente ajustable ligne par ligne dans le panier avant validation (ex: "3 cubes Maggi à 100F au lieu de 150F") — surcharge uniquement cette vente, jamais le prix catalogue du produit
- Fix fausse "déconnexion" pendant l'indexation — cold-start Render sans retry sur `creerProduit`/`ajusterStock` (le correctif retry x2 existait déjà pour `creerVente` mais n'avait jamais été répercuté ailleurs)
- Nouveau logo PWA (maison verte, remplace le logo Angular par défaut) sur toutes les icônes du manifest + favicon + login + register, ajusté sur plusieurs itérations avec retours visuels précis de l'utilisateur (comparaison pixel par pixel avec la maquette)
- Vente à crédit dans le panier agent, cloisonnement des ventes par agent (chaque agent voit ses ventes uniquement, patron voit tout + filtre par agent), refonte "Relances" → "Prêts" (todo-list clients paid/unpaid, notifie uniquement le patron)
- Vente détail/gros, scan rapide togglable, filtres stock, alertes péremption
- Fix base Dexie cassée (`DatabaseClosedError`) suite à une migration de structure du panier hors-ligne + lectures caméra erronées (checksum EAN-13/8/UPC-A + double lecture avant validation)
- Page "Mon compte" patron branchée (route + lien topbar), toggle afficher/masquer les mots de passe

## Résolu avant ça (2026-08-15 → 2026-08-16), pour référence rapide

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
