# KIRALIS

Plateforme SaaS de gestion d’agences de location de véhicules conçue pour le marché tunisien (avec préparation pour le Maroc, la région MENA et l’Europe).

## Périmètre actuel

- **Phase 1 — Fondation applicative (terminée)** : interface Next.js App Router responsive, barre latérale et barre supérieure, thèmes clair/sombre persistants, interface française par défaut avec traductions anglaise et arabe (RTL), formatage monétaire exact en dinar tunisien (`TND` à 3 décimales, calculs en millimes entiers), fuseau horaire `Africa/Tunis`, et 11 routes fonctionnelles avec états vides honnêtes (aucune donnée métier simulée).
- **Phase 2 — Préparation GitHub & Vercel (terminée)** : hygiène de dépôt (`.gitignore`, `.env.example` sans secrets), scripts de vérification (`dev`, `build`, `lint`, `typecheck`, `test`) et configuration `vercel.json`.
- **Phase 3 — Base de données Supabase (migrations prêtes, exécution Supabase requise)** : schéma PostgreSQL multi-agences (6 tables, clés étrangères composites, montants en millimes entiers, exclusion GiST anti-chevauchement), politiques RLS, fonctions sécurisées, suite de tests SQL (`supabase/tests/rls_verification.sql`) et guide dédié dans [`docs/supabase-setup.md`](docs/supabase-setup.md).
- **Phases ultérieures (non connectées)** : intégration Supabase Auth et écrans métier connectés, puis Assistant IA côté serveur via Gemini API.

## Stack technique

- **Framework** : Next.js (App Router) + React 19
- **Langage** : TypeScript (strict)
- **Styles** : Tailwind CSS v4
- **Base de données & Authentification (prévues)** : Supabase PostgreSQL, Supabase Auth, Supabase Storage
- **IA (prévue côté serveur)** : Gemini API (`@google/genai`)
- **Hébergement cible** : Vercel
- **Gestion de version** : GitHub (`kiralis`)

## Prérequis

- Node.js 20+
- npm 10+

## Démarrage local

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Créer votre fichier d’environnement local à partir du modèle (sans jamais commiter `.env.local`) :

   ```bash
   cp .env.example .env.local
   ```

3. Lancer le serveur de développement :

   ```bash
   npm run dev
   ```

L’application est accessible sur `http://localhost:3000`.

## Scripts disponibles

| Script | Description |
| --- | --- |
| `npm run dev` | Démarre le serveur de développement Next.js |
| `npm run build` | Compile l’application pour la production |
| `npm run start` | Démarre le build de production compilé |
| `npm run lint` | Exécute ESLint sur l’ensemble du projet |
| `npm run typecheck` | Vérifie les types TypeScript (`tsc --noEmit`) |
| `npm run test` | Exécute les tests unitaires (`lib/*.test.ts`) |

## Variables d’environnement

Le fichier `.env.example` recense uniquement les noms de variables (sans aucune valeur secrète).

### Variables requises (Supabase — nouveau format de clé API)

- `NEXT_PUBLIC_SUPABASE_URL` — URL de votre projet Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Clé publique Supabase (`sb_publishable_...`), utilisée exclusivement avec Supabase Auth, les requêtes liées à l’utilisateur et Row Level Security (RLS).

> Aucune clé `SUPABASE_SERVICE_ROLE_KEY` ni clé secrète (`sb_secret_...`) n’est requise pour les opérations courantes d’agence et ne doit jamais être exposée côté client.

### Variables optionnelles

- `NEXT_PUBLIC_APP_URL` / `APP_URL` — **Optionnel pour la prévisualisation de développement** (l’origine courante validée est utilisée automatiquement via `lib/supabase/env.ts`). À définir explicitement uniquement comme URL canonique pour les redirections en production.
- `GEMINI_API_KEY` — Clé serveur Gemini uniquement pour la phase Assistant IA (ne jamais préfixer avec `NEXT_PUBLIC_`).

## Sécurité et hygiène Git

- Tous les fichiers `.env*` (sauf `.env.example`), clés privées (`*.pem`, `*.key`), fichiers d’identifiants et artefacts de build (`.next/`, `.vercel/`, `coverage/`, `*.tsbuildinfo`) sont exclus par `.gitignore`.
- Aucune clé API ni donnée confidentielle ne doit être commitée dans le dépôt.

## Intégration GitHub et Vercel (étapes manuelles)

### 1. Connecter le dépôt GitHub `kiralis`

```bash
git init -b main
git add .
git status
git commit -m "chore: phase 1 foundation and phase 2 github setup"
git remote add origin https://github.com/<votre-compte>/kiralis.git
git push -u origin main
```

*(Si un historique Git existe déjà localement, ne pas relancer `git init` : ajoutez uniquement le dépôt distant `origin` puis poussez la branche existante.)*

### 2. Connecter le projet dans Vercel (sans déploiement automatique ici)

1. Dans le tableau de bord Vercel, cliquez sur **Add New… → Project** et importez le dépôt GitHub `kiralis`.
2. Vérifiez que le framework détecté est **Next.js** (configuration alignée avec `vercel.json`).
3. Déclarez les variables d’environnement nécessaires dans **Settings → Environment Variables** (uniquement lorsque les intégrations Supabase / Gemini seront activées).
4. Activez les déploiements Preview sur Pull Requests et Production sur `main`.
