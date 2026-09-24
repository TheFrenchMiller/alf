markdown
# Alf 2.0.1 - Notes de projet

Assistant personnel autonome d'Erwan (The French Miller / WARM-TV / Wearerockmetal).

## Démarrage rapide

Deux terminaux, dans `alf-2.0.1-hq/` :

**Terminal 1 - Backend (orchestrateur) :**
npm run server

text

**Terminal 2 - Interface :**
npm run tauri dev

text

Les deux doivent tourner en parallèle.

**Lancement rapide :** un fichier `Alf.bat` sur le bureau lance les deux automatiquement.

## Modèle Gemini

**Modèle actuel :** `gemini-3.1-flash-lite` (dans `server/orchestrator.ts` et `mcp-servers/mcp-dev.js`)

**Latence mesurée :** ~2 secondes

**Modèles à éviter :**
- `gemini-3.5-flash-lite` : 111 secondes (saturé chez Google)
- `gemini-3.6-flash` : 503 UNAVAILABLE
- `gemini-2.5-flash-lite` et `gemini-2.5-flash` : plus disponibles

**Tester un modèle :**
node test-gemini.js

text

### Token Instagram

Un token permanent (utilisateur système Meta) est stocké dans `mcp-servers/.env` sous `INSTAGRAM_TOKEN`.

**Pour le régénérer :** business.facebook.com → Paramètres → Utilisateurs système → ton utilisateur → Générer un nouveau token → Jamais d'expiration.

### Clé Gemini API

`GEMINI_API_KEY` doit être présente dans **deux** `.env` :
- `alf-2.0.1-hq/server/.env` — pour l'orchestrateur
- `mcp-servers/.env` — pour `mcp-dev.js` (analyser_image, lire_pdf)

## Serveurs MCP connectés

**5 serveurs, 20 outils au total.**

### `email` (mcp-email.js) — 3 outils

- `lister_emails_non_lus` — liste les mails non lus d'un compte
- `lire_email_complet` — lit le contenu complet d'un mail via son UID. Extrait automatiquement les pièces jointes dans `2026.09_DATA_WARM_TV/sources-warmtv/emails/AAAA-MM-JJ-expediteur-sujet/`
- `envoyer_email` — envoie un mail (validation obligatoire)

**3 comptes gérés :**
- `thefrenchmiller` (Hostinger)
- `wearerockmetal` (Hostinger)
- `yahoo`

### `instagram` (mcp-instagram.js) — 3 outils

- `instagram_get_profile` — profil du compte (followers, bio, posts)
- `instagram_get_recent_posts` — derniers posts avec likes/commentaires
- `instagram_get_insights` — statistiques (reach, vues de profil, engagement)

**2 comptes gérés :**
- `thefrenchmiller` — compte Instagram pro
- `warmtv` — compte Instagram WARM-TV

### `dev` (mcp-dev.js) — 6 outils

- `lister_dossier` — liste les fichiers et sous-dossiers d'un chemin
- `lister_recursif` — idem mais explore toute l'arborescence (profondeur max configurable)
- `lire_fichier` — lit le contenu d'un fichier de code (limite 200 Ko)
- `ecrire_fichier` — crée ou écrase un fichier
- `analyser_image` — analyse une image via Gemini Vision (photos de concert, pochettes, affiches)
- `lire_pdf` — extrait le texte d'un PDF via Gemini (communiqués de presse, dossiers)

**Sécurité :** Alf ne peut accéder qu'aux fichiers **sous** la racine définie par `DEV_ROOT_PATH` dans `.env`. Par défaut : `D:/Documents/2026 - Web`.

### `websearch` (Brave Search) — 2 outils

- `brave_web_search` — recherche web
- `brave_local_search` — recherche locale

**Configuration :**
- Clé API dans `mcp-servers/.env` sous `BRAVE_API_KEY`
- Serveur MCP officiel : `@modelcontextprotocol/server-brave-search`
- Domaine : `recherche`
- Utiliser `${BRAVE_API_KEY}` dans `mcp.config.json` (substitution par `substituteEnvVars()` dans `mcp-manager.ts`)
- Obtenir une clé : https://brave.com/search/api/

### `wordpress` (mcp-wordpress.js) — 7 outils

- `wp_lister_articles` — liste les articles (filtrable par statut)
- `wp_lire_article` — lit le contenu complet d'un article via son ID
- `wp_chercher_articles` — recherche par mot-clé
- `wp_creer_brouillon` — crée un brouillon (validation obligatoire). Accepte des métadonnées Yoast optionnelles
- `wp_modifier_article` — modifie un article existant (validation obligatoire)
- `wp_definir_yoast` — définit/modifie les métadonnées Yoast SEO d'un article (validation obligatoire)
- `wp_lister_categories` — liste les catégories du site

**Configuration :**
- Variables dans `mcp-servers/.env` : `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`
- Le mot de passe est un **Application Password** WordPress (généré dans `/wp-admin` → Utilisateurs → Profil)
- **Prérequis Hostinger** : ajouter `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` dans le `.htaccess` à la racine du site
- Site : `https://wearerockmetal.com`

**Sécurité :**
- Les brouillons sont créés avec `status: "draft"` — jamais publiés directement
- Validation manuelle obligatoire pour `wp_creer_brouillon`, `wp_modifier_article` et `wp_definir_yoast`

### Yoast SEO — intégration

**Les métadonnées Yoast sont accessibles en écriture via l'API REST WP** (pas de snippet PHP nécessaire). Testé et validé sur Hostinger.

**Champs gérés :**

| Arg MCP | Meta WordPress | Label Yoast | Longueur cible |
|---|---|---|---|
| `mot_cle_focus` | `_yoast_wpseo_focuskw` | Expression clé principale | 1-4 mots |
| `titre_seo` | `_yoast_wpseo_title` | Titre SEO | 55-60 car. |
| `meta_description` | `_yoast_wpseo_metadesc` | Méta description | 140-155 car. |

**Utilisation :** ces 3 champs sont acceptés en args optionnels de `wp_creer_brouillon`, et modifiables via `wp_definir_yoast` (par ID).

**En lecture :** `yoast_head_json` expose le titre, la description, le canonical, les Twitter Cards et le Schema.org d'un article.

## Prompt éditorial WARM-TV

Alf écrit avec le ton WARM-TV : direct, passionné, énergique.

**Boîte à outils** (10 règles) :
1. Autodérision
2. Brise le 4e mur
3. Mots-valises et néologismes
4. Titres de morceaux tissés dans la narration
5. Calembours téléphonés
6. Métaphores physiques et viscérales
7. Références Pop & Geek désinvoltes
8. Fuies le bullshit
9. Incises et parenthèses
10. Conclusion passionnée

**Principe fondamental** : ce sont des OUTILS, pas une CHECKLIST. Ne jamais tous les appliquer dans un même article. Piocher selon le type de contenu.

**Dosage par type :**
- Chronique d'album : 1, 4, 5, 6, 10
- News : 1, 2, 5, 8
- Live report : 2, 6, 7, 9, 10
- Interview : 1, 3, 7, 8

**Format WordPress** : HTML avec `<p>`, `<h2>`, `<strong>` (groupes), `<em>` (albums).
**Longueurs cibles** : 400-600 mots (chronique), 200-300 (news), 600-900 (live report).

**Règles dures ajoutées :**
- **Interdiction d'ouverture par cliché** — liste noire de formules ("ne sont pas là pour enfiler des perles", "ça va faire mal", etc.)
- **Balises mécaniques** : `<strong>` sur TOUS les noms de groupes à CHAQUE occurrence, `<em>` sur TOUS les titres d'albums à CHAQUE occurrence. Test de vérification obligatoire.
- **Vérifications finales** : 4 points à checker avant de rendre (balises groupes, balises albums, phrases ≤ 25 mots, adresse au lecteur pour les news)

**À éviter** : appliquer les 10 outils partout, forcer un calembour, mettre trop de références Pop/Geek, répéter les mêmes expressions, ouvrir par un cliché.

**Personas multiples** : prévu dans une version future.

## Ajouter un serveur MCP

1. Créer le script dans `mcp-servers/mcp-xxx.js`
2. Ajouter une entrée dans `server/mcp.config.json`
3. Relancer `npm run server`

**Pour les secrets :** utiliser `${VAR_NAME}` dans `mcp.config.json` et ajouter `VAR_NAME=...` dans `mcp-servers/.env`.

## Pièges connus

- `.env` avec caractères spéciaux : utiliser des guillemets simples
- `dotenv.config()` : toujours préciser le chemin absolu
- Modèle Gemini lent : tester avec `node test-gemini.js` avant de changer
- IMAP AUTHENTICATIONFAILED : vérifier le mot de passe de la boîte mail, pas celui de l'hébergeur
- Gemini formate en Markdown par défaut → ajouter une règle "FORMAT DE RÉPONSE OBLIGATOIRE" dans le SYSTEM_INSTRUCTION d'orchestrator.ts
- `useSpeech` lit les symboles Markdown → utiliser `cleanForSpeech()` dans App.tsx avant d'appeler speak()
- System prompt vs interception : le prompt doit dire à l'agent QUAND appeler l'outil, le code gère CE QUI SE PASSE après. Ne pas dupliquer la logique de validation dans les deux.
- Cargo "not found" : fermer VS Code complètement, ou redémarrer Windows. Bug de PATH intermittent.
- **Hostinger WordPress** : le header `Authorization` est filtré par défaut. Ajouter la règle `SetEnvIf` dans le `.htaccess` pour que l'API REST accepte les Application Passwords.
- **Gemini "lite" n'applique pas les règles mécaniques du premier coup** : forcer avec des formulations "MÉCANIQUE, pas sémantique", "à CHAQUE occurrence", et un "TEST DE VÉRIFICATION AVANT DE RENDRE TA COPIE". Le modèle a tendance à n'appliquer la règle qu'à la première occurrence.
- **Yoast SEO** : pas besoin de `register_meta` explicite. Les meta `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_focuskw` sont déjà exposés en écriture via l'API REST. Il suffit de les passer dans `body.meta` lors d'un POST/PUT.
- **URLs longues dans les emails** : `break-words` ne suffit pas. Utiliser `[overflow-wrap:anywhere]` en Tailwind arbitrary value.
- **Compteurs Yoast dans le renderer** : couleur rouge uniquement en cas de dépassement, gris neutre sinon (choix "Option A" — éviter le bruit visuel).

## API HTTP

**Base :** `http://localhost:3001`

- `GET /status` — état des serveurs MCP
- `GET /tools` — liste des outils
- `POST /chat` — envoyer un message
- `POST /reset` — réinitialiser une conversation
- `POST /transcribe` — transcrire un audio via Gemini
- `POST /execute-action` — exécuter une action validée manuellement

## Système de validation manuelle

Certains outils ne s'exécutent JAMAIS automatiquement. Ils sont créés en "PendingAction" et attendent une validation de l'utilisateur dans l'interface.

**Outils concernés** (dans `orchestrator.ts` → `TOOLS_REQUIRING_VALIDATION`) :
- `envoyer_email` — affichage via EmailSendRenderer avec bouton ✅ Envoyer
- `wp_creer_brouillon` — affichage via WordPressDraftRenderer avec aperçu HTML, compteur de mots et bloc Yoast
- `wp_modifier_article` — affichage JSON brut pour l'instant
- `wp_definir_yoast` — fallback amber pour l'instant

**Flux :**
1. Gemini appelle l'outil → intercepté par `chat()`
2. Création d'une PendingAction (id, toolName, args, createdAt)
3. Renvoyée dans ChatResponse.pendingActions
4. Affichée dans le panneau d'actions avec bouton ✅
5. Clic → POST /execute-action → `executePendingAction()` → MCP → exécution réelle

**Pour ajouter un outil à validation :**
1. L'ajouter dans `TOOLS_REQUIRING_VALIDATION` (server/orchestrator.ts)
2. Créer un renderer dédié si besoin (src/components/actions/)
3. Ajouter un case dans `ActionDispatcher.tsx`

## Prochaines étapes

- [x] Ajouter la voix (window.speechSynthesis)
- [x] Ajouter le serveur MCP dev (mcp-dev.js)
- [x] Recherche web (Brave Search)
- [x] Renderers d'actions riches (validation email)
- [x] Serveur MCP WordPress
- [x] Renderer pour wp_creer_brouillon (aperçu propre du brouillon)
- [x] Intégration Yoast SEO (expression clé, titre SEO, méta description)
- [x] Renderer pour wp_definir_yoast (aperçu des modifs SEO)
- [x] Renderer pour wp_modifier_article (avant/après)
- [ ] Workflow éditorial (suggestion de sujets, préparation d'itw)
- [ ] Renderers Instagram
- [ ] Renderers Dev
- [ ] App Review Meta pour la publication Instagram
- [ ] Vrai packaging Tauri (un seul .exe)

## Changelog

### Session du 24/09/2026

**Ajouts :**
- Intégration complète Yoast SEO (création + modification)
- Nouvel outil MCP `wp_definir_yoast`
- Renderer WordPressDraftRenderer enrichi (HTML interprété, compteur de mots, bloc Yoast avec compteurs et alertes)

**Corrections :**
- URLs longues dans EmailReadRenderer (`[overflow-wrap:anywhere]`)
- Prompt éditorial : interdiction d'ouverture par cliché
- Prompt éditorial : règle mécanique sur les balises `<strong>` / `<em>` (le modèle n'appliquait la règle qu'à la première occurrence)

**Découvertes :**
- `analyser_image` et `lire_pdf` existent bien, dans `mcp-dev.js` (le markdown.txt initial était incomplet)
- Yoast est accessible en écriture via l'API REST sans `register_meta`
- `mcp-dev.js` expose 6 outils (pas 3)
- Brave Search expose 2 outils (pas 1)

## Futurs MCP envisagés

- **photos** : tri, dédoublonnage, renommage (racine : `D:/Photos`)
- **archives** : compression, sauvegardes (racine : `E:/Sauvegardes`)
- **docs** : classement, OCR, conversion (racine : `D:/Documents/Perso`)

## Architecture
alf-2.0.1-hq/
├── server/ # Backend orchestrateur (TypeScript)
│ ├── types.ts # Types partagés
│ ├── mcp.config.json # Manifeste des serveurs MCP
│ ├── mcp-manager.ts # Gestion des connexions MCP
│ ├── orchestrator.ts # Logique Gemini + boucle d'outils
│ └── index.ts # Serveur Express (port 3001)
├── src/ # Frontend React
│ ├── api.ts # Client API vers l'orchestrateur
│ ├── types.ts # Types locaux
│ ├── App.tsx # Assemblage principal
│ ├── hooks/
│ │ ├── useSpeech.ts # Synthèse vocale (sortie)
│ │ └── useAudioRecorder.ts # Enregistrement micro (entrée)
│ └── components/
│ ├── Avatar.tsx # Avatar animé (4 états)
│ ├── Sidebar.tsx # Colonne gauche (domaines + serveurs)
│ ├── ChatPanel.tsx # Colonne centre (chat)
│ ├── ActionPanel.tsx # Colonne droite (actions effectuées)
│ └── actions/ # Renderers d'actions
│ ├── ActionDispatcher.tsx
│ ├── DefaultRenderer.tsx
│ ├── EmailListRenderer.tsx
│ ├── EmailReadRenderer.tsx
│ ├── EmailSendRenderer.tsx
│ └── WordPressDraftRenderer.tsx
└── src-tauri/ # Coquille Tauri (Rust)

mcp-servers/ # (hors alf-2.0.1-hq, au-dessus)
├── mcp-email.js
├── mcp-instagram.js
├── mcp-dev.js
├── mcp-wordpress.js
└── .env

text

Projet développé pour Erwan (The French Miller / WARM-TV / Wearerockmetal).
Démarrage : septembre 2026.