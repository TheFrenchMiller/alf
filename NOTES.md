# Alf 2.0.1 - Notes de projet

Assistant personnel autonome d'Erwan (The French Miller / WARM-TV / Wearerockmetal).

## Démarrage

### Mode Application autonome (Production / Quotidien)

Alf est packagé en application Windows autonome via Tauri + NSIS :
- **Exécutable installé :** `C:\Users\erwan\AppData\Local\Alf\alf-201-hq.exe`
- **Installateur NSIS :** `alf-2.0.1-hq/src-tauri/target/release/bundle/nsis/Alf_0.1.0_x64-setup.exe`

Au lancement, l'interface démarre automatiquement :
1. Le sidecar backend (`binaries/alf-backend`) via `src/hooks/useBackend.ts` sur le port `3001`
2. Les 5 serveurs MCP déclarés dans `server/mcp.config.json`
3. Le serveur vocal local **Pocket TTS** (`uvx pocket-tts serve`) sur le port `8000`

### Mode Développement

Deux terminaux, dans `alf-2.0.1-hq/` :

**Terminal 1 - Backend (orchestrateur) :**
```bash
npm run server
```

**Terminal 2 - Interface :**
```bash
npm run tauri dev
```

### Prérequis système Windows (en cas de réinitialisation PC)

Même en version `.exe`, Alf dépend de deux outils installés sur `C:\` :
1. **Node.js LTS** (`node` et `npx` dans le `PATH`) — requis par `alf-backend` pour lancer les serveurs MCP (`mcp-*.js` et Brave Search).
   - Penser à autoriser les scripts PowerShell : `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`
2. **`uv` / `uvx`** — requis par `server/index.ts` au chemin exact `C:\Users\erwan\.local\bin\uvx.exe` pour faire tourner **Pocket TTS**.
   - Commande d'installation : `winget install --id astral-sh.uv -e` (et vérifier que `uv.exe` / `uvx.exe` sont bien présents dans `C:\Users\erwan\.local\bin\`).

## Modèles Gemini & Synthèse Vocale

### Modèles Gemini utilisés

- **Modèle principal (Chat, Vision, Extraction) :** `gemini-3.8-flash`
  - Utilisé dans `server/orchestrator.ts`, `mcp-servers/mcp-email.js`, `mcp-servers/mcp-wordpress.js` et `mcp-servers/mcp-dev.js`
- **Modèle de transcription audio (Micro) :** `gemini-3.5-transcribe`
  - Utilisé dans `server/orchestrator.ts` (`transcribe()`), avec lecture de `audioTranscription.text` et 3 tentatives automatiques en cas d'erreur `503 UNAVAILABLE`

**Modèles historiques à éviter :**
- `gemini-3.5-flash-lite` : saturé (latence > 100s)
- `gemini-3.6-flash` : 503 UNAVAILABLE
- `gemini-2.5-flash-lite` et `gemini-2.5-flash` : retirés

**Tester un modèle :**
```bash
node test-gemini.js
```

### Synthèse vocale (Pocket TTS + Fallback navigateur)

- **Moteur principal :** **Pocket TTS** lancé en sous-processus par `server/index.ts` :
  ```bash
  C:\Users\erwan\.local\bin\uvx.exe pocket-tts serve --language french --default-voice estelle
  ```
  Écoute sur `http://localhost:8000` (configurable via `POCKET_TTS_VOICE` et `POCKET_TTS_LANG` dans `.env`).
- **Route backend :** `POST /speak` (convertit le texte en audio WAV via Pocket TTS).
- **Fallback automatique :** dans `src/hooks/useSpeech.ts`, si Pocket TTS n'est pas disponible (503 ou erreur réseau), Alf bascule automatiquement sur la synthèse vocale du navigateur (`window.speechSynthesis`).

### Fichier `.env` centralisé

Toutes les clés API et identifiants sont centralisés dans **`mcp-servers/.env`** (chargé automatiquement par `server/index.ts` via `ALF_ENV_PATH` ou `../mcp-servers/.env`, ainsi que par chaque serveur MCP) :
- `GEMINI_API_KEY` — clé API Google Gemini
- `BRAVE_API_KEY` — clé API Brave Search
- `INSTAGRAM_TOKEN`, `INSTAGRAM_ACCOUNT_FRENCHMILLER`, `INSTAGRAM_ACCOUNT_WARMTV` — token permanent (utilisateur système Meta) et IDs des comptes
- `EMAIL_USER*`, `EMAIL_PASSWORD*`, `EMAIL_HOST*`, `SMTP_HOST*` — identifiants IMAP/SMTP des 3 boîtes mail
- `WP_URL`, `WP_USER`, `WP_APP_PASSWORD` — accès API REST WordPress (`https://wearerockmetal.com`)
- `DEV_ROOT_PATH` — racine autorisée pour les outils fichiers (`D:/Documents/2026 - Web`)

## Serveurs MCP connectés

**5 serveurs, 23 outils au total** (timeout d'appel MCP fixé à **10 minutes** dans `mcp-manager.ts` pour supporter les traitements lourds d'images).

### 1. `email` (`mcp-email.js` v6.1.0) — 4 outils

- `lister_emails_non_lus` — check rapide des derniers mails non lus (max 5) d'un compte
- `chercher_emails` — recherche IMAP multicritères :
  - `lu` (`"true"`, `"false"`, `"any"`)
  - `date_debut` / `date_fin` (`YYYY-MM-DD`, date de fin inclusive grâce à l'ajout automatique d'un jour sur la clause IMAP `BEFORE`)
  - `expediteur` (`FROM`), `sujet` (`SUBJECT`), `limit` (défaut 20, max 50)
- `lire_email_complet` — lit un mail via son UID sans le marquer comme lu (`markSeen: false`) et réalise un pipeline complet dans `2026.09_DATA_WARM_TV/sources-warmtv/emails/AAAA-MM-JJ-expediteur-sujet/` :
  1. Extraction des pièces jointes
  2. Téléchargement des images CDN présentes dans le HTML (avec filtrage `URL_BLACKLIST` : icônes réseaux sociaux, pixels de tracking, spacers, signatures)
  3. Déduplication automatique des fichiers par empreinte **MD5**
  4. Extraction structurée via Gemini (`gemini-3.8-flash`) enregistrée dans **`metadata.json`** (`groupe`, `label`, `photographe`, `date_sortie`, `type_evenement`, `contact_presse`, `resume`)
- `envoyer_email` — envoie un mail via SMTP (validation manuelle obligatoire)

**3 comptes gérés :**
- `thefrenchmiller` (Hostinger)
- `wearerockmetal` (Hostinger)
- `yahoo`

### 2. `wordpress` (`mcp-wordpress.js` v1.7.0) — 8 outils

- `wp_lister_articles` — liste les articles (filtrable par statut : `publish`, `draft`, `pending`, `any`)
- `wp_lire_article` — lit le contenu complet d'un article via son ID
- `wp_chercher_articles` — recherche par mot-clé
- `wp_lister_categories` — liste les catégories du site avec leur ID
- `wp_uploader_media` — uploade un fichier image local vers la médiathèque WordPress avec `titre` et `alt_text` (validation obligatoire)
- `preparer_article_avec_images` — **workflow complet automatisé de création d'article à partir d'un dossier de sources** (validation obligatoire) :
  1. Lit `metadata.json` dans `dossier_sources` (récupère `groupe`, `photographe`, `resume`)
  2. Ignore les fichiers `< 500 octets` et classifie chaque image via Gemini Vision (`ALBUM_COVER`, `PHOTO_PROMO`, `PROMO_BANNER`, `TOUR_POSTER`, `MERCH_MOCKUP`, `BAND_LOGO`, `LABEL_LOGO`, `PLATFORM_LOGO`, `VIDEO_THUMBNAIL`, `NOISE`)
  3. Filtre uniquement les visuels éditoriaux utiles (`ALBUM_COVER`, `PHOTO_PROMO`, `PROMO_BANNER`, `TOUR_POSTER`, `MERCH_MOCKUP`)
  4. Renomme les fichiers selon la convention SEO (ex. `groupe-album-cover.jpg`, `groupe-promo-photographe-1.jpg`)
  5. Uploade les images sur WordPress avec `title` et `alt_text`
  6. Définit automatiquement `ALBUM_COVER` comme image à la une (`featured_media`)
  7. Insère les balises `<img>` des autres visuels dans le contenu (`debut`, `fin` ou `aucune`)
  8. Crée le brouillon WordPress (`status: "draft"`) avec catégories, extrait et métadonnées Yoast SEO
- `wp_creer_brouillon` — crée un brouillon simple avec `featured_media_id` optionnel et métadonnées Yoast SEO (validation obligatoire)
- `wp_modifier_article` — modifie un article existant avec suivi avant/après `_avant_titre`, `_avant_contenu`, `_avant_extrait` (validation obligatoire)
- `wp_definir_yoast` — définit/modifie les métadonnées Yoast SEO d'un article existant par ID (validation obligatoire)

**Yoast SEO — champs gérés via l'API REST WP (`body.meta`) :**

| Arg MCP | Meta WordPress | Label Yoast | Règle stricte |
|---|---|---|---|
| `mot_cle_focus` | `_yoast_wpseo_focuskw` | Expression clé principale | **≤ 4 mots** |
| `titre_seo` | `_yoast_wpseo_title` | Titre SEO | **≤ 60 caractères** |
| `meta_description` | `_yoast_wpseo_metadesc` | Méta description | **≤ 150 caractères** (cible 140-150) |

### 3. `instagram` (`mcp-instagram.js`) — 3 outils

- `instagram_get_profile` — profil du compte (followers, abonnements, posts, bio)
- `instagram_get_recent_posts` — derniers posts avec likes, commentaires et dates
- `instagram_get_insights` — statistiques (reach, vues de profil, comptes engagés, interactions totales)

**2 comptes gérés :** `thefrenchmiller` et `warmtv`

### 4. `dev` (`mcp-dev.js`) — 6 outils

- `lister_dossier` — liste les fichiers et sous-dossiers d'un chemin
- `lister_recursif` — explore toute l'arborescence (profondeur max configurable, défaut 5)
- `lire_fichier` — lit le contenu d'un fichier texte (limite 200 Ko)
- `ecrire_fichier` — crée ou écrase un fichier
- `analyser_image` — analyse une image via Gemini Vision (`gemini-3.8-flash`)
- `lire_pdf` — extrait le texte d'un PDF via Gemini (`gemini-3.8-flash`)

**Sécurité :** accès restreint à `DEV_ROOT_PATH` (`D:/Documents/2026 - Web`).

### 5. `websearch` (Brave Search) — 2 outils

- `brave_web_search` — recherche web
- `brave_local_search` — recherche locale

## Prompt éditorial WARM-TV

Alf écrit avec le ton WARM-TV : direct, passionné, énergique.

**Boîte à outils (10 règles — à doser selon le format, ne jamais tout utiliser d'un coup) :**
1. Autodérision
2. Brise le 4e mur
3. Mots-valises et néologismes
4. Titres de morceaux tissés dans la narration
5. Calembours téléphonés
6. Métaphores physiques et viscérales
7. Références Pop & Geek désinvoltes (1 à 2 max par article)
8. Fuis le bullshit
9. Incises et parenthèses
10. Conclusion passionnée (en variant les formules de clôture d'un article à l'autre)

**Dosage par type & longueurs cibles :**
- **News** (200-300 mots, pas de `<h2>`) : outils 1, 2, 5, 8
- **Chronique d'album** (400-600 mots, 2 à 3 `<h2>`) : outils 1, 4, 5, 6, 10
- **Interview** (600-900 mots, 3 à 5 `<h2>`) : outils 1, 3, 7, 8
- **Live report — Concert unique** (500-800 mots, 3 à 4 `<h2>`) : outils 2, 6, 7, 9, 10
- **Live report — Festival 1 jour** (1200-1800 mots, 5 à 8 `<h2>`)
- **Live report — Festival multi-jours** : un article par journée
- **Dossier thématique** (1500-2500 mots, 6 à 10 `<h2>`)

**Règles dures du prompt (`server/orchestrator.ts`) :**
- **Interdiction d'ouverture par cliché** (liste noire stricte) → ouvrir par un détail concret (date, chiffre, lieu, image visuelle, question).
- **Balises mécaniques** : `<strong>` sur TOUS les noms de groupes/artistes à CHAQUE occurrence, `<em>` sur TOUS les titres d'albums/morceaux à CHAQUE occurrence.
- **Anti-hallucination** : ne jamais inventer le nombre de membres d'un groupe ni les détails d'un événement réel ; ne jamais modifier ou inventer un chemin de fichier (`2026.09_DATA_WARM_TV/sources-warmtv/emails/`).
- **Format HTML WordPress** : pas de titre dans le corps, commence toujours par `<p>`, pas de `<img>` manuel lors de l'utilisation de `preparer_article_avec_images`.

## API HTTP (`server/index.ts`)

**Base :** `http://localhost:3001`

- `GET /status` — état des serveurs MCP et nombre total d'outils
- `GET /tools` — liste des outils (globale et par domaine)
- `POST /chat` — envoyer un message à l'orchestrateur
- `POST /reset` — réinitialiser une conversation
- `POST /transcribe` — transcrire un audio via `gemini-3.5-transcribe`
- `POST /execute-action` — exécuter une action validée manuellement
- `POST /speak` — synthèse vocale via Pocket TTS (renvoie un flux `audio/wav` ou `503` pour fallback navigateur)

## Système de validation manuelle

Les outils sensibles listés dans `TOOLS_REQUIRING_VALIDATION` (`server/orchestrator.ts`) sont interceptés avant exécution et renvoyés dans `pendingActions` (la boucle d'appel d'outils s'arrête immédiatement avec `break` pour éviter que Gemini ne rappelle l'outil en doublon) :

- `envoyer_email` → `EmailSendRenderer.tsx`
- `preparer_article_avec_images` → `PrepareArticleRenderer.tsx` (aperçu complet, compteurs Yoast, verrouillage du bouton au clic, lien admin WP après création)
- `wp_creer_brouillon` → `WordPressDraftRenderer.tsx`
- `wp_modifier_article` → `WordPressModifyRenderer.tsx` (comparaison avant/après)
- `wp_definir_yoast` → `WordPressYoastRenderer.tsx`
- `wp_uploader_media` → fallback de validation dans `ActionDispatcher.tsx`

## Architecture

```text
alf-2.0.1-hq/
├── server/                        # Backend orchestrateur (TypeScript)
│   ├── types.ts                   # Types partagés
│   ├── mcp.config.json            # Manifeste des 5 serveurs MCP
│   ├── mcp-manager.ts             # Gestion des connexions MCP (support sidecar + dev)
│   ├── orchestrator.ts            # Logique Gemini (gemini-3.8-flash) + prompt système
│   └── index.ts                   # Serveur Express (port 3001) + Pocket TTS (port 8000)
├── src/                           # Frontend React
│   ├── api.ts                     # Client HTTP vers localhost:3001
│   ├── types.ts                   # Types frontend
│   ├── App.tsx                    # Assemblage principal + cleanForSpeech()
│   ├── hooks/
│   │   ├── useBackend.ts          # Lancement du sidecar binaries/alf-backend + polling /status
│   │   ├── useSpeech.ts           # Synthèse vocale (Pocket TTS en priorité, fallback navigateur)
│   │   └── useAudioRecorder.ts    # Enregistrement micro
│   └── components/
│       ├── Avatar.tsx             # Avatar animé (4 états)
│       ├── Sidebar.tsx            # Colonne gauche (domaines + serveurs)
│       ├── ChatPanel.tsx          # Colonne centre (chat)
│       ├── ActionPanel.tsx        # Colonne droite (actions & validations)
│       └── actions/               # Renderers d'actions
│           ├── ActionDispatcher.tsx
│           ├── DefaultRenderer.tsx
│           ├── EmailListRenderer.tsx
│           ├── EmailReadRenderer.tsx
│           ├── EmailSendRenderer.tsx
│           ├── PrepareArticleRenderer.tsx
│           ├── WordPressDraftRenderer.tsx
│           ├── WordPressModifyRenderer.tsx
│           └── WordPressYoastRenderer.tsx
└── src-tauri/                     # Coquille Tauri v2 (Rust)
    ├── binaries/                  # Sidecar compilé (alf-backend)
    └── target/release/bundle/nsis/Alf_0.1.0_x64-setup.exe

mcp-servers/                       # Serveurs MCP (dossier parent)
├── mcp-email.js                   # IMAP/SMTP + téléchargement images CDN + dédup MD5 + metadata.json
├── mcp-wordpress.js               # API REST WP + Yoast SEO + preparer_article_avec_images (Vision)
├── mcp-dev.js                     # Exploration fichiers + Gemini Vision & PDF
├── mcp-instagram.js               # Graph API Instagram
└── .env                           # Configuration et secrets centralisés
```

## Prochaines étapes

- [x] Ajouter la voix (`window.speechSynthesis` puis **Pocket TTS** avec voix française `estelle`)
- [x] Ajouter le serveur MCP dev (`mcp-dev.js`)
- [x] Recherche web (Brave Search)
- [x] Renderers d'actions riches (validation email)
- [x] Serveur MCP WordPress + intégration Yoast SEO
- [x] Renderers pour `wp_creer_brouillon`, `wp_definir_yoast` et `wp_modifier_article`
- [x] Recherche avancée d'emails (`chercher_emails`) + extraction automatique `metadata.json` et déduplication d'images
- [x] Workflow complet `preparer_article_avec_images` (classification Gemini Vision, renommage SEO, upload WP, mise à la une) + `PrepareArticleRenderer`
- [x] Packaging Tauri autonome avec sidecar (`Alf_0.1.0_x64-setup.exe` + `useBackend.ts`)
- [ ] Workflow éditorial (suggestion proactive de sujets, préparation d'interviews)
- [ ] Renderers dédiés Instagram et Dev
- [ ] Personas multiples pour varier les plumes sur WARM-TV
- [ ] App Review Meta pour la publication Instagram

## Changelog

### Session du 10/11/2026
- Réinstallation de l'environnement système suite à la réinitialisation de Windows 11 (`Node.js LTS`, `uv` / `uvx` dans `.local\bin` pour Pocket TTS, politique PowerShell `RemoteSigned`, réinstallation de `Alf_0.1.0_x64-setup.exe`).
- Mise à jour complète de `NOTES.md` pour refléter toutes les évolutions réalisées entre fin septembre et octobre 2026.

### Sessions du 27/09/2026 au 20/10/2026
- **Packaging Tauri & Sidecar** : intégration de `alf-backend` en sidecar Tauri (`useBackend.ts`), résolution dynamique des chemins MCP (`ALF_ENV_PATH`, `ALF_MCP_CONFIG_PATH`, `MCP_SERVERS_DIR`) et génération de l'installateur NSIS `Alf_0.1.0_x64-setup.exe`.
- **Synthèse vocale Pocket TTS** : lancement automatique de `uvx pocket-tts serve` par le backend (`server/index.ts`), endpoint `POST /speak` et hook `useSpeech.ts` avec fallback navigateur.
- **Modèles Gemini** : passage à `gemini-3.8-flash` (orchestrateur + serveurs MCP) et `gemini-3.5-transcribe` pour la dictée vocale avec retry automatique.
- **Workflow `preparer_article_avec_images`** : classification automatique des images par Gemini Vision, renommage SEO avec crédit photographe, upload média WordPress, définition automatique de la pochette en image à la une et composant `PrepareArticleRenderer.tsx`.
- **Email MCP v6.1.0** : ajout de `chercher_emails` (filtres IMAP par statut, dates, expéditeur, sujet), téléchargement des images CDN, déduplication MD5 et génération automatique de `metadata.json` via Gemini.
- **Renderers WordPress** : ajout de `WordPressModifyRenderer.tsx` et `WordPressYoastRenderer.tsx`.

### Session du 24/09/2026
- Intégration Yoast SEO (`wp_definir_yoast`, `WordPressDraftRenderer`).
- Corrections `EmailReadRenderer` et durcissement du prompt éditorial (liste noire de clichés d'ouverture, balises mécaniques `<strong>` / `<em>`).
