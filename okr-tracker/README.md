# OKR Tracker 2027 – Living Goods

Application web de suivi des OKR 2027 : 4 objectifs globaux, 20 KR globaux, ~100 KR pays/équipes,
leurs initiatives et jalons trimestriels. Interface en français ; les intitulés des OKR restent en
anglais, comme dans le fichier source *2027 OKR Consolidated Plans_V2.xlsx*.

Architecture, modèle de données, règles d'import et de calcul : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Le design reprend celui du tableau de bord **Big Wins** (dépôt `BigWin`) : barre du haut bleu marine, onglets,
polices Oswald et Source Sans 3, cartes KPI, tableaux à en-tête marine, badges de statut pleins,
barre de navigation en bas sur mobile, écran de connexion plein écran (mode Supabase).

## Installation

Prérequis : Node.js 20 ou plus.

```bash
cd okr-tracker
npm install
npm run dev        # http://localhost:5173
```

Autres commandes : `npm test` (import et calculs), `npm run build` (site statique dans `dist/`).

Sans configuration, l'application démarre en **mode local** : les données restent dans le navigateur
(localStorage) et l'on choisit un profil simulé dans Administration pour tester les droits.

## Import du fichier Excel

1. Ouvrir **Administration → Choisir le fichier Excel** et sélectionner *2027 OKR Consolidated Plans_V2.xlsx*.
2. Lire le **rapport d'import** : KR, initiatives et jalons par onglet, remarques, contrôles
   (20 KR globaux, ~100 KR pays/équipes, KR globaux sans Lead…).
3. Cliquer sur **Appliquer l'import**.
4. Facultatif : **Générer des statuts Q1 fictifs (démo)** pour voir le tableau de bord rempli.
   Ces statuts sont marqués « [DÉMO] » et « Démo (fictif) » dans l'historique.

Un **réimport** met à jour la structure et conserve les check-ins, l'historique et les poids des KR et
initiatives dont l'intitulé n'a pas changé. Faire une **sauvegarde JSON** avant (mode local).

Contrôle en ligne de commande, sans navigateur :

```bash
npx tsx scripts/check-import.ts "2027 OKR Consolidated Plans_V2.xlsx"
```

`scripts/make-test-workbook.ts` produit un classeur **fictif** de même structure (tests uniquement).

## Fichier HTML autonome (test local, sans publication)

```bash
npm run build:single
```

Produit `dist-single/okr-tracker-2027.html` : un seul fichier qui s'ouvre par double-clic dans le
navigateur, sans serveur. Mode local : les données importées restent dans ce navigateur.

## Mode Supabase (multi-utilisateurs, droits réels)

1. Créer un projet sur supabase.com.
2. Exécuter `supabase/migrations/001_schema.sql` (SQL Editor, ou `supabase db push` avec la CLI).
3. Créer `okr-tracker/.env.local` à partir de `.env.example` :
   ```
   VITE_SUPABASE_URL=https://<projet>.supabase.co
   VITE_SUPABASE_ANON_KEY=<clé anon/publishable>
   ```
4. Se connecter une première fois (lien e-mail) depuis Administration, puis promouvoir ce compte admin :
   ```sql
   update profiles set role = 'admin' where email = '<votre e-mail>';
   ```
5. Importer l'Excel. Chaque nouvel utilisateur s'inscrit par lien e-mail (rôle Lecteur par défaut) ;
   l'admin lui donne ensuite un rôle (Lead pays, Lead équipe) et un périmètre.

Les droits sont appliqués dans la base par la Row Level Security : un Lead pays ne peut écrire que sur
les lignes de son pays, même en appelant l'API directement.

## Déploiement

Le build est un site statique (`npm run build` → `dist/`, chemins relatifs, routes à hash).
Il se publie tel quel sur Netlify, Vercel, Cloudflare Pages, GitHub Pages ou tout serveur web.
Définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables de build de l'hébergeur.
La clé *anon* est publique par conception : la sécurité repose sur la RLS.

## Structure

```
okr-tracker/
  supabase/migrations/001_schema.sql   schéma, RLS, import_dataset(), vue okr_register
  src/types.ts                         types TypeScript (miroir du schéma)
  src/lib/import/                      import Excel (SheetJS) et normalisation
  src/lib/progress.ts                  consolidation, RAG, alertes
  src/lib/merge.ts                     réimport sans perte des check-ins
  src/lib/store/                       localStorage | Supabase
  src/pages/                           Dashboard, CountryView, TeamView, GlobalKRView, CheckIn, Register, Annexes, Admin
  tests/                               tests de l'import et du calcul (classeur fictif)
```

## Limites connues

* Les pays visés par les initiatives des équipes globales sont déduits du texte (noms de pays,
  « all countries ») : à vérifier dans le check-in (Paramètres de l'initiative).
* La cible quantitative est le dernier nombre du jalon Q4 : à corriger si le jalon Q4 n'est pas chiffré.
* SheetJS est installé depuis npm (0.18.5). Pour la dernière version, remplacer la dépendance par
  `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
