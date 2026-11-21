# Architecture · OKR Tracker 2027 – Living Goods

## 1. Vue d'ensemble

```
 Excel (.xlsx) ──► Import SheetJS (navigateur) ──► Dataset normalisé ──► Store ──► Pages React
                    src/lib/import/excel.ts          src/types.ts          │
                    • dépliage des fusions                                 ├─ localStorage (v1, mode local)
                    • propagation vers le bas                              └─ Supabase (Postgres + Auth + RLS)
                    • dédoublonnage, IDs stables
                    • rapport d'import
                                                     Moteur de calcul (pur, testé)
                                                     src/lib/progress.ts : jalon → … → objectif global, RAG, alertes
```

* **Front** : React 18 + TypeScript + Tailwind + Recharts, routeur à hash (hébergement statique).
* **Persistance** : une interface `Store` (`src/lib/store/types.ts`) et deux implémentations.
  Sans variables `VITE_SUPABASE_*`, l'application tourne en **mode local** (localStorage, utilisateurs
  simulés). Avec, elle passe en **mode Supabase** (comptes réels, droits appliqués par la RLS).
* **Calculs** : toujours côté client, sur le jeu de données complet (~100 KR, ~1 000 jalons : instantané).
  Le trimestre choisi dans la barre du haut recalcule tout l'arbre.

## 2. Modèle de données

```
GlobalObjective (4)                    global_objectives
 └─ GlobalKR (20)                      global_krs
     └─ Contribution                   contributions   {entity, role Lead|Contributes, weight, scope}
         └─ EntityKR (~100)            entity_krs      (KR pays ou équipe)
             ├─ EntityObjective        entity_objectives
             └─ Initiative (1..n)      initiatives     lead, baseline, metric, evidence rule, budget, pays visés
                 └─ Milestone (Q1–Q4)  milestones      statut, réel, preuve, commentaire
                     └─ MilestoneUpdate milestone_updates (historique, insertion seule)
Entity                                 entities        Country | GlobalTeam, group (Global Programs)
```

Détails des types : `src/types.ts`. Schéma SQL : `supabase/migrations/001_schema.sql`.

**Identifiants stables.** Les ID sont calculés à partir du contenu (`kenya-kr-<hash du texte du KR>`,
`…-i-<hash de l'initiative>`, `…-q1`). Un réimport retrouve les mêmes jalons : statuts, valeurs,
preuves, historique et poids sont conservés (`src/lib/merge.ts` en local, `import_dataset()` en SQL).
Corollaire : si l'intitulé d'un KR ou d'une initiative change dans l'Excel, c'est un nouvel objet
(l'ancien et son historique disparaissent au réimport). Faire une sauvegarde JSON avant un réimport majeur.

## 3. Import Excel (`src/lib/import/excel.ts`)

| Onglet | Traitement |
|---|---|
| `Ref Global OKRs` | Cellules « Objective N … » et « KRn.m … » → 4 objectifs, 20 KR. À défaut, titres des en-têtes « OBJECTIVE X · … ». |
| `2 Kenya` … `4c Zambia` | Entité = pays d'après le nom de l'onglet. |
| `5 Global Programs` | Entité = colonne Team/Unit (Innovations, PEI, PSE). |
| `6 GSE` … `11 P&C` | Entité = équipe d'après le nom de l'onglet. |
| `1 OKR Register` | Liens KR global ↔ KR d'entité (rôle, scope). Rapprochement du texte du KR avec ceux des onglets (identique, inclus, ou ≥ 60 % de mots communs) ; sinon KR « registre seul ». |
| `Annex …` | Tableau brut, affiché dans la page Annexes. |

Règles :
1. Ligne d'en-tête détectée automatiquement (présence de « Ref » et d'un « Key Result »), colonnes reconnues par leur intitulé (tolérant aux variantes).
2. `!merges` : la valeur d'une cellule fusionnée est recopiée dans toute la zone.
3. Propagation vers le bas de Ref, Global Key Result, Team/Unit, objectif, KR, KR Lead : une cellule vide = initiative supplémentaire du KR du dessus.
4. Lignes `OBJECTIVE X · …` : en-têtes de section, ignorées (et réinitialisent la propagation).
5. Dédoublonnage : KR par (entité, texte normalisé) ; initiative par (KR, texte, jalons). Doublons signalés.
6. Un jalon n'est créé que si la cellule Qn n'est pas vide.
7. Valeurs numériques : baseline = premier nombre de « Current Baseline », cible = dernier nombre du jalon Q4 (années 2024–2035 ignorées), pour les métriques Numeric/Percentage. Cible modifiable dans le check-in.
8. Pays visés par une initiative d'équipe globale : noms de pays (EN/FR) ou « all countries » dans le texte. Corrigeable à la main.
9. Liens présents dans la colonne Ref d'un onglet mais absents du registre : ajoutés en *Contributes* et marqués « déduit ».

Rapport : lignes, en-têtes de section, KR, initiatives, jalons et remarques par onglet ; contrôles
(4 objectifs, 20 KR globaux, 80–130 KR d'entité, chaque KR global a un Lead, KR du registre retrouvés).

## 4. Consolidation (`src/lib/progress.ts`)

| Niveau | Règle |
|---|---|
| Jalon | Non démarré 0 · En cours 50 · Atteint 100 · En retard = `lateScore` (0 par défaut) + signalé · Annulé exclu |
| Initiative | Moyenne des jalons échus (Q ≤ trimestre choisi). Quantitatif en plus : (réel − baseline) / (cible − baseline) |
| KR pays/équipe | Moyenne des initiatives (+ moyenne des avancements quantitatifs, affichée à part) |
| Objectif pays/équipe | Moyenne de ses KR ; avancement de l'entité = moyenne de ses objectifs |
| KR global | Moyenne pondérée des KR liés : Lead 2, Contributes 1, poids par lien modifiable |
| Objectif global | Moyenne de ses KR globaux |

RAG : Vert ≥ 70 %, Ambre 40–69 %, Rouge < 40 % **ou** au moins un jalon en retard dans le périmètre ;
gris = aucune donnée. Seuils et poids réglables (Administration).

Alertes : jalons en retard, KR sans données au trimestre, KR sans initiative, valeurs à compléter
(`[X]`, `[Y]`, `TBC`, `TBD`, `xx`), KR globaux sans Lead.

## 5. Droits

| Rôle | Lecture | Écriture |
|---|---|---|
| Admin (Strategy/PMO) | tout | tout : import, paramètres, poids, utilisateurs |
| Lead pays | tout | KR, initiatives et check-ins de **son** pays (`user_entities`) |
| Lead équipe globale | tout | idem pour **son** équipe |
| Lecteur | tout | rien |

En mode Supabase, la RLS (`can_edit_entity()`, `is_admin()`) fait foi ; l'interface masque seulement
les actions interdites. En mode local, les droits ne sont qu'une simulation.

## 6. Pages

| Route | Page |
|---|---|
| `/` | Tableau de bord global : cartes objectifs (jauge), heatmap KR globaux × entités, alertes, filtre trimestre |
| `/pays/:id` | Vue pays : objectif pays, KR + KR global soutenu, initiatives, timeline Q1–Q4, appui des équipes globales, export Excel/PDF |
| `/equipe/:id` | Vue équipe : KR, initiatives, KR globaux soutenus, pays bénéficiaires, budget indicatif |
| `/kr/:id` | Vue KR global : graphique de contribution par entité, arbre KR → entités → initiatives → jalons |
| `/check-in` | Mise à jour trimestrielle (mobile) : statut, réel, preuve, commentaire, historique |
| `/registre` | Registre OKR filtrable, triable, export Excel/CSV |
| `/annexes` | Annex A et Annex B |
| `/admin` | Import/réimport, statuts Q1 fictifs (démo), sauvegarde, utilisateurs, poids, seuils |
