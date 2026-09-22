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

## Modèle Gemini

**Modèle actuel :** `gemini-3.1-flash-lite` (dans `server/orchestrator.ts`)
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

## Serveurs MCP connectés

### `email` (mcp-email.js) — 3 outils

- `lister_emails_non_lus` — liste les mails non lus d'un compte
- `lire_email_complet` — lit le contenu complet d'un mail via son UID
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

### `dev` (mcp-dev.js) — 3 outils

- `lister_dossier` — liste les fichiers et sous-dossiers d'un chemin
- `lire_fichier` — lit le contenu d'un fichier de code
- `ecrire_fichier` — crée ou écrase un fichier

**Sécurité :** Alf ne peut accéder qu'aux fichiers **sous** la racine définie par `DEV_ROOT_PATH` dans `.env`. Par défaut : `D:/Documents/2026 - Web`.

### `websearch` (Brave Search)

Recherche web en temps réel via l'API Brave Search.

**Outils exposés :** `brave_web_search`

**Configuration :**
- Clé API dans `mcp-servers/.env` sous `BRAVE_API_KEY`
- Serveur MCP officiel : `@modelcontextprotocol/server-brave-search`
- Domaine : `recherche`
- Utiliser `${BRAVE_API_KEY}` dans `mcp.config.json` (substitution par `substituteEnvVars()` dans `mcp-manager.ts`)
- Obtenir une clé : https://brave.com/search/api/

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

Outils concernés (dans `orchestrator.ts` → `TOOLS_REQUIRING_VALIDATION`) :
- `envoyer_email` — affichage via EmailSendRenderer avec bouton ✅ Envoyer

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
- [x] Renderers d'actions riches (validation email)
- [x] Recherche web (Brave Search)
- [ ] Renderers pour Instagram (profil, posts, insights)
- [ ] Renderers pour dev (diff avant/après pour les écritures)
- [ ] Renderer pour Brave Search
- [ ] App Review Meta pour la publication Instagram
- [ ] Enrichir le system prompt

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
│ └── EmailSendRenderer.tsx
└── src-tauri/ # Coquille Tauri (Rust)

mcp-servers/ # (hors alf-2.0.1-hq, au-dessus)
├── mcp-email.js
├── mcp-instagram.js
├── mcp-dev.js
└── .env

text

Projet développé pour Erwan (The French Miller / WARM-TV / Wearerockmetal).
Démarrage : septembre 2026.