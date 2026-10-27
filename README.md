# Évaluation économique des projets de santé · Economic evaluation of health projects

Interface bilingue français / anglais (bouton en haut à droite). Bilingual French / English interface (button at top right).

**Dès l'accueil, on choisit le type d'analyse** : analyse des coûts simple, ROI, coût-efficacité
ou analyse complète. L'outil n'affiche ensuite que les étapes et les champs utiles (pas de DALY à
saisir pour une simple analyse des coûts, par exemple).

Chaque activité a un code, un **statut** (connu, estimé, en attente, hors budget) et se supprime d'un clic.
Les activités en attente sont listées mais exclues des totaux : l'estimation est alors signalée « partielle ».
L'exemple chargé par défaut reprend les **données de l'innovation** (triage numérique, scénario central
Phase 3 : couches A, B et C du modèle de coûts).

Outil en ligne (R Shiny) qui fonctionne pour **tous les projets de santé**. L'intervenant décrit
son projet, répond à quelques questions (profil d'analyse), renseigne ses activités, et obtient :

- **Coûts** : total nominal et actualisé, investissement, fonctionnement, coûts par année,
  coût par bénéficiaire (total et par an), coût par résultat de chaque activité ;
- **Coût-efficacité** : DALY évitées, ACER, ACER net, ΔC, ΔE, **ICER** face à la pratique actuelle
  ou à l'absence d'intervention, dominance, bénéfice monétaire net (NMB) et sanitaire net (NHB),
  verdict au seuil choisi ;
- **Rendement financier** : économies, VAN, **ROI**, ratio bénéfice/coût, année de retour ;
- **Incertitude** : tornade, simulation de Monte-Carlo, courbe d'acceptabilité, intervalles à 95 % ;
- **Rapport imprimable** (PDF via le navigateur), export CSV, enregistrement du projet (.json).

Les écrans s'adaptent aux réponses : DALY saisies directement ou calculées (YLL + YLD),
économies, comparateur et analyse probabiliste ne s'affichent que si le projet en a besoin.
Pays, monnaie, PIB, seuil et nombre d'activités sont libres.

Méthode : Drummond et al. (2015), guide OMS-CHOICE (2003), iDSI Reference Case (2016),
Stinnett & Mullahy (1998). Détails et références dans l'onglet « Méthode et sources ».

## DermaSuivi

Le dossier `dermasuivi/` contient une application distincte de suivi photo de la cicatrisation
(voir `dermasuivi/README.md`), publiée sur GitHub Pages dans `/dermasuivi/`.

## Structure

```
app/
  app.R      interface Shiny
  calcul.R   moteur de calcul coût-efficacité (sans dépendance à Shiny)
tests/
  test-calcul.R   tests du moteur (testthat)
  run.R
.github/workflows/deploy.yml   tests + publication sur GitHub Pages
```

## Lancer en local

```r
install.packages(c("shiny", "bslib", "jsonlite", "testthat"))
shiny::runApp("app")
```

Tests : `Rscript tests/run.R` depuis la racine du dépôt.

## Publication

Dans **Settings → Pages → Source**, choisir **GitHub Actions**. Chaque push sur `main`
lance les tests, exporte l'application avec Shinylive et la publie.
