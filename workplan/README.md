# Plan de travail · gestion de projet (équipes globales et pays)

Outil de gestion de projet pour le plan de travail annuel. Hiérarchie (WBS) :
**objectif → projet (KR global / Ref) → tâches** des équipes globales (PEI, PSE, Innovations, GSE, DHGP,
BDAC, Finance, DT, P&C) et des pays. Chaque tâche pays **dépend** de tâches d'équipes globales ;
sans dépendance, elle est signalée **« orpheline, non liée au global »**. Une tâche globale sans pays est normale.

Palette Living Goods (bleu #004D84, orange #F7941D, bleu ciel #4FB3E3, gris #6D6E71) sur fond blanc, police **Garamond** (EB Garamond, repli Garamond / Georgia), interface épurée : six vues principales
(Tableau de bord, Plan de travail, Gantt, Kanban, Échéancier, Risques & actions), les autres dans « Plus ».

| Vue | Contenu |
|---|---|
| Plan de travail | Tableau principal **par objectif** : un groupe par projet, cellules Statut et Priorité colorées modifiables d’un clic, responsable, échéance, échéancier, synthèse des statuts |
| Tableau de bord | Avancement, tâches terminées / en cours / en retard, échéances à 30 jours, échéances par mois, objectifs, équipes et pays, risques ouverts |
| Tableau détaillé (WBS) | Tableau numéroté 1 / 1.1 / 1.1.1, repliable ; responsable, début, échéance, durée, statut et % modifiables, priorité, dépendances (numéros WBS), alignement ; export Excel |
| Gantt | Barres sur l'année (zoom semaine / mois / trimestre), % réalisé, jalons, aujourd'hui, retards |
| Kanban | Colonnes À faire / En cours / En retard / Terminé / Annulé, glisser-déposer, option une ligne par équipe ou pays |
| Échéancier | Retards, 30 prochains jours, puis échéances mois par mois |
| Responsables | Charge par personne : tâches, en cours, terminées, en retard, prochaine échéance |
| Risques & actions | Registre (risque / problème, constat, action, responsable, échéance, statut), alimenté par l'analyse d'alignement |
| Alignement global ↔ pays | Synthèse Aligned / Partial / Conflict / Gap / Global only, orphelins à rattacher, parties A et B |
| Indicateurs | Indicateurs de mesure à chaque niveau, valeurs trimestrielles |
| Plans annuels | Un plan par année ; le suivant reprend la structure, les dépendances et les échéances (décalées d'un an) |

Les filtres (équipe / pays, responsable, statut, priorité, en retard, orphelines) sont communs à toutes les vues.
Chaque changement de statut ou d'avancement est historisé.

**Échéances** : lues dans l'intitulé de chaque tâche (« By 31 March 2027 » → 31/03/2027, « By Q2 2027 » →
30/06/2027, « By June 2027 » → 30/06/2027) ; à défaut, 31 décembre. Modifiables dans la fiche de la tâche.

## Import du fichier OKR (deux feuilles)

* **Registre** (« OR register ») : `Ref | Global Key Result | Country / Team | Role | Country/Team Objective |
  Country/Team Key Result | KR Lead | Scope | Go to plan`, avec les lignes `OBJECTIVE N · …`.
  * chaque ligne devient un KR / une activité d'**équipe globale** (Global Programs (PEI), PSE, Innovations, GSE,
    DHGP, BDAC, Finance, DT, P&C) ou de **pays** (Kenya, « Kenya (Finance & Admin) » = Kenya, sous-équipe
    Finance & Admin, Burkina Faso, Uganda, Benin, Zambia) ;
  * `Team KR · O1` = KR d'équipe sans KR global ; « No country/team plan yet » = KR global sans plan (signalé).
* **Analyse d'alignement** (« alignement du OKR ») :
  * **A · KR pays → soutenu par quelles équipes globales ?** (même Ref) → liens, statut, constat, action ;
  * **B · KR d'équipe globale → quels pays s'y engagent ?** → statut, constat, action ;
  * statuts : Aligned, Partial, Conflict, Gap, Global only ; un KR pays sans équipe globale (« — none — ») est
    **orphelin, non lié au global**.

Un **réimport** met le plan à jour (mêmes unité, Ref et intitulé) **sans perdre le suivi** (statuts,
avancement, indicateurs, historique) ; l'option « remplacer » repart de zéro.

## Calcul de l'avancement

* Activité = moyenne de [exécution (% saisi ; Réalisée = 100 %), indicateurs de l'activité].
* Activité globale consolidée = moyenne de [son avancement, moyenne des activités pays liées].
* KR = moyenne de [activités globales, indicateurs du KR] ; objectif = moyenne de [KR, indicateurs] ; plan = moyenne des objectifs.
* Indicateur = (valeur − baseline) / (cible − baseline), borné 0–100 % (cible à la hausse ou à la baisse) ; Oui/Non = 0 ou 100 %.
* Couleurs : vert ≥ 70 %, ambre ≥ 40 %, rouge en dessous ou si une activité est en retard
  (statut « En retard » ou trimestre de fin dépassé). Seuils réglables.

## Utilisation

**Sans installation** : ouvrir `plan-de-travail.html` (généré par `npm run build:single`) par double-clic.

**Fichier pré-rempli avec un plan** (données intégrées, à ne pas publier ni versionner) :

```bash
npx tsx scripts/build-seed.ts classeur.xlsx 2027 /chemin/hors-depot/plan.json
npm run build:single -- --seed /chemin/hors-depot/plan.json --out plan-de-travail-2027
```
Les données restent dans le navigateur (enregistrement automatique) ; exporter une sauvegarde JSON
depuis « Plans annuels » pour la conserver ou la transmettre.

**Développement** :

```bash
cd workplan
npm install
npm run dev
```

Tests : `npm test` (import du registre et de l'analyse, liens multiples, orphelins, réimport sans perte,
consolidation, plans annuels, performance). Contrôle sur le vrai classeur, en local :
`OKR_XLSX=/chemin/classeur.xlsx npm test` (vérifie que la synthèse de l'analyse est reproduite).

## Structure

```
src/types.ts          modèle de données (plans annuels, unités, objectifs, KR, KR/activités d'équipes et de pays, indicateurs)
src/lib/calc.ts       consolidation, alignement / orphelines, alertes (temps linéaire)
src/lib/ops.ts        opérations : créer / dupliquer un plan, éditer, lier, suggestions de rattachement
src/lib/importer.ts   import du classeur OKR (registre + analyse d'alignement A et B)
src/lib/storage.ts    stockage local + sauvegarde JSON
src/pages/            pages de l'application
```
