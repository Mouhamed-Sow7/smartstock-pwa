# SmartStock Frontend — Changelog technique

> Archive chronologique détaillée. **Ne pas charger par défaut en début de session** — sert uniquement à investiguer une régression ou comprendre le "pourquoi" d'une décision passée. L'état courant est dans `STATE.md`.

## 2026-08

- `81f2fda` — Double compensation de safe-area sur topbar/main-content (CSS global `!important` qui dupliquait ce que les composants géraient déjà) → contenu coupé/débordant en PWA standalone.
- `783cfbd` — Modal fantôme après création/modif produit : `await` sur Dexie sort de la zone Angular sur certains navigateurs (iOS) → `dialogRef.close()` s'exécute hors zone → overlay ne se nettoie pas visuellement. Fix : `NgZone.run()` sur tous les callbacks concernés (`produit-dialog`, `scan-ajout`, `produits.component`).
- `54b8124` — Fixes groupés :
  - Bande noire bas d'écran iOS standalone (manifest sans `theme_color`/`background_color` + `position:fixed;inset:0` sur les layouts).
  - Login par téléphone après inscription cassé : ni register ni login ne normalisaient le numéro (espaces, +221) avant envoi backend → mismatch. Fix : `normaliserTelephone()` identique des deux côtés.
  - Admin : bouton reset mdp par agent (dropdown "Équipe"), pas de "voir mdp existant" (hashé côté backend, irrécupérable par design).
  - Scan caméra lent sur iOS : pas de `BarcodeDetector` natif dans WebKit → fallback ZXing (CPU pur). Résolution caméra idéale réduite (1280x720 au lieu de 1920x1080) uniquement pour ce fallback.
- `583cad8` (commit externe) — Bug racine de la bande noire iOS isolé : `.bottom-nav` avait un `padding-bottom: var(--safe-bot)` créant un espace mort **à l'intérieur** de l'élément, pas hors de l'app.
- `8f1fb73` — Pull automatique des produits à chaque reconnexion réseau (`online` event), pas seulement push des ventes/stocks en attente. Corrige la fenêtre de latence où un produit créé ailleurs restait invisible en offline sur une session déjà ouverte.
- `9cb68da` — Retrait complet d'un panneau de debug temporaire (safe-area/viewport diagnostic) ajouté puis retiré avant présentation client.
- `b96d0e4` — UI : thème clair par défaut (`ThemeService`, seulement pour les nouveaux users sans préférence sauvée), neutralisation du flash bleu au tap (`-webkit-tap-highlight-color: transparent` global — vraie cause du "bleu zinzin"), refonte du bandeau sync/offline (couleurs thème accent teal `#00b894` au lieu d'orange arbitraire, icône qui pulse doucement au lieu de tourner en boucle).
- `8c447f5` — **Bug important** : une vente faite offline juste après création offline d'un produit gardait `produitId: "temp_xxx"` en mémoire pour toujours. `syncProduit()` remplaçait bien le produit temp par le vrai dans le cache, mais ne remappait jamais les ventes/stocks *déjà en attente* qui référençaient ce temp_id → 500 en boucle infinie côté backend (le frontend traite les 500 comme erreurs réseau temporaires, retry infini). Fix : `remapProduitIdDansPending()` dans `OfflineService`, appelé juste après `remplacerProduitTemp()`.

## Investigations closes (pour référence, ne pas rouvrir)

- **"Les changements ne s'affichent jamais"** (thème resté sombre, ancien bandeau, texte "Connexion rétablie" disparu du code depuis le tout premier commit). Hypothèses explorées : service worker figé, mauvais domaine Vercel non lié à la prod. Vérifié sur Vercel (capture d'écran) : le déploiement du domaine `cyan.vercel.app` était bien "Ready Latest" / "Production" / "Current" sur le bon commit → **pas un problème de déploiement Vercel**. Cause probable : cache navigateur/service worker plus tenace que prévu, résolu depuis (le passage au nouveau domaine `smartstock.digitalesf.com` a forcé un état complètement frais).
