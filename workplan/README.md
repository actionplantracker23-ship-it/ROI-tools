# Plan de travail · global, départements et pays

Outil de gestion du plan de travail annuel :

1. **Créer le plan de l'année** (vierge, ou en reprenant la structure du plan précédent : objectifs, KR,
   activités globales et pays avec leurs liens, registre, indicateurs ; le suivi repart de zéro et les
   baselines peuvent reprendre les dernières valeurs mesurées).
2. **Plan global** : objectifs → KR globaux → **activités des départements globaux**.
3. **Activités pays**, chacune **liée à une activité globale**. Une activité pays sans lien est signalée
   **« orpheline, non liée au global »**. Une activité globale sans déclinaison pays est normale.
4. **Indicateurs de mesure du résultat à chaque niveau** (objectif, KR, activité globale, activité pays) :
   baseline, cibles Q1–Q4 et finale, valeurs trimestrielles avec preuve et historique.
5. **Suivi trimestriel** (statut, avancement, commentaire, historique), tableau de bord, alertes, exports Excel.

## Pages

| Page | Contenu |
|---|---|
| Tableau de bord | Avancement du plan, objectifs, départements et pays, alignement, alertes |
| Plan de travail | Arbre Objectif → KR → activités globales → activités pays ; création et édition à chaque niveau |
| Activités globales / Activités pays | Tables par département / par pays, filtres, export ; orphelines signalées |
| Alignement | Taux d'alignement, graphique par pays, orphelines avec suggestions de rattachement en un clic, matrice activités globales × pays |
| Suivi trimestriel | Mise à jour rapide des activités et des valeurs d'indicateurs (mobile) |
| Indicateurs | Tous les indicateurs, valeurs et cibles par trimestre, export |
| Registre OKR | Format source : Ref, Global Key Result, Country / Team, Role, …, Scope, Go to plan, sections « OBJECTIVE X · … » |
| Import Excel | Fichier à deux feuilles avec correspondance des colonnes (voir ci-dessous) |
| Plans annuels | Créer, ouvrir, clôturer un plan ; sauvegarde / restauration JSON |
| Paramètres | Départements et pays, trimestre en cours, seuils de couleur |

## Import du fichier Excel (deux feuilles)

* **Registre OKR** : `Ref | Global Key Result | Country / Team | Role | Country/Team Objective |
  Country/Team Key Result | KR Lead | Scope | Go to plan`, avec les lignes de section
  `OBJECTIVE 1 · …` qui donnent les titres des objectifs.
* **Analyse d'alignement** (activités globales ↔ pays), deux formats :
  * une ligne par lien : `Ref | Département | Activité globale | Pays | Activité pays | Alignement | Commentaire` ;
  * une colonne par pays : `Ref | Département | Activité globale | Kenya | Burkina Faso | …` (la cellule
    contient l'activité pays, une par ligne).

Les feuilles, la ligne d'en-tête et les colonnes sont reconnues automatiquement ; chaque correspondance
est modifiable, avec des exemples de valeurs, et un aperçu (activités, liens, orphelines) s'affiche avant
d'appliquer. Règles :

* cellules fusionnées dépliées ; Ref, département et pays vides = valeur du dessus ;
* **orpheline** : ligne pays sans activité globale, ou marquée « non aligné / orphelin » ;
* **ligne de suite** (option activée par défaut) : une cellule « Activité globale » vide reprend celle du
  dessus si Ref et Département sont vides aussi et que la ligne n'est pas marquée non alignée ;
* statut « partiel » → lien partiel ; départements ou pays inconnus créés et signalés.

## Calcul de l'avancement

* Activité = moyenne de [exécution (% saisi ; Réalisée = 100 %), indicateurs de l'activité].
* Activité globale consolidée = moyenne de [son avancement, moyenne des activités pays liées].
* KR = moyenne de [activités globales, indicateurs du KR] ; objectif = moyenne de [KR, indicateurs] ; plan = moyenne des objectifs.
* Indicateur = (valeur − baseline) / (cible − baseline), borné 0–100 % (cible à la hausse ou à la baisse) ; Oui/Non = 0 ou 100 %.
* Couleurs : vert ≥ 70 %, ambre ≥ 40 %, rouge en dessous ou si une activité est en retard
  (statut « En retard » ou trimestre de fin dépassé). Seuils réglables.

## Utilisation

**Sans installation** : ouvrir `plan-de-travail.html` (généré par `npm run build:single`) par double-clic.
Les données restent dans le navigateur (enregistrement automatique) ; exporter une sauvegarde JSON
depuis « Plans annuels » pour la conserver ou la transmettre.

**Développement** :

```bash
cd workplan
npm install
npm run dev
```

Tests : `npm test` (import des deux formats, orphelines, lignes de suite, consolidation, plans annuels,
performance). Fichier de test fictif : `npx tsx scripts/make-test-workbook.ts test.xlsx`.

## Structure

```
src/types.ts          modèle de données (plans annuels, unités, objectifs, KR, registre, activités, indicateurs)
src/lib/calc.ts       consolidation, alignement / orphelines, alertes (temps linéaire)
src/lib/ops.ts        opérations : créer / dupliquer un plan, éditer, lier, suggestions de rattachement
src/lib/importer.ts   import Excel à deux feuilles avec correspondance de colonnes
src/lib/storage.ts    stockage local + sauvegarde JSON
src/pages/            pages de l'application
```
