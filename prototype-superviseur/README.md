# Prototype : application de supervision des ASBC

Prototype HTML de l'application Android qui remplacera le formulaire Kobo
`supervision_asbc_v2` (version 20251105). L'application **lit le XLSForm lui-même** :
mettre à jour le formulaire dans Excel puis relancer la génération suffit.

## Ce que fait le prototype

- **Formulaire complet** découpé en écrans (un par section du XLSForm), avec barre de
  progression, sommaire et brouillon automatique.
- Logique Kobo reprise : `relevant`, `calculation`, `constraint`, `required`,
  listes en cascade (`choice_filter`, région → ASBC), répétitions (`begin_repeat`),
  géolocalisation, signature (`draw`).
- **Score global en direct** dans l'en-tête, puis résultat par section à la finalisation.
- **Hors ligne** : les fiches restent sur le téléphone et sont envoyées au retour du réseau
  (l'envoi est simulé dans le prototype).
- **Activité daily eSanteCom** (onglet Daily) : synthèse du jour (ou des 6 jours précédents) des six
  activités des ASBC du CSPS :
  1. prise en charge des enfants (PCIME) ;
  2. enregistrement des grossesses ;
  3. visites de grossesse (1re, 2e, 3e visite) ;
  4. suivi des nouveau-nés (1re, 2e, 3e visite et visites supplémentaires faible poids) ;
  5. visites à domicile (VAD) ;
  6. causeries éducatives (thème, participants).

  Alertes : signe de danger non référé (enfant, femme enceinte, nouveau-né), TDR positif sans
  CTA, téléphone non synchronisé depuis 3 jours. Détail par ASBC activité par activité, et bouton
  « Superviser » qui préremplit le lieu dans la fiche de supervision.
- **RMA eSanteCom** (onglet RMA, rapport mensuel d'activités) : complétude, promptitude, tendance sur 6 mois et indicateurs
  du CSPS rangés selon les six activités, avec comparaison « déclaré » (rapport de l'ASBC) /
  « eSanteCom » (somme des saisies quotidiennes), validation ou renvoi de chaque rapport, puis
  transmission au district.
  **Ces deux écrans utilisent des données simulées** (générateur déterministe, ASBC anonymisés
  « ASBC n · village ») : l'application réelle lira l'API eSanteCom.
- **Plan d'action** : les lignes du « Plan de résolution des problèmes » de chaque fiche,
  avec échéance et suivi.
- **Français / anglais** : bouton FR | EN dans l'en-tête. L'interface et les 625 libellés du
  formulaire (questions, choix, messages, notes de score) sont traduits. Les réponses restent
  enregistrées avec les codes du XLSForm : le changement de langue ne modifie pas les données.
- **Contrôle du XLSForm** (lien « Formulaire Kobo » sur l'accueil) : codes de choix cités dans les expressions
  mais absents des listes.

## Générer le prototype

```bash
pip install openpyxl
python3 build.py chemin/vers/supervision_asbc_v2.xlsx            # -> index.html autonome
python3 build.py formulaire.xlsx sortie.html --sans-corrections   # sans corriger les codes
python3 build.py formulaire.xlsx --xlsform-bilingue bilingue.xlsx  # XLSForm Kobo FR + EN
```

## Traduction

- `traduction_en.json` : dictionnaire « libellé français → anglais » pour le formulaire
  (questions, choix, messages de contrainte, notes et valeurs de performance calculées).
  Une question ajoutée ou modifiée dans le XLSForm apparaît en français tant qu'elle n'est pas
  ajoutée au fichier ; l'onglet Formulaire affiche le taux de couverture.
- Interface : dictionnaire `UI_EN` dans `app.html` (fonctions `t()`, `tf()`, `tv()`).
- `--xlsform-bilingue` écrit une copie du XLSForm avec les colonnes `label::English` et
  `constraint_message::English` : la même traduction sert dans Kobo / ODK Collect.
- Pour ajouter une langue (mooré, dioula, fulfuldé…) : un fichier `traduction_xx.json`, un
  dictionnaire d'interface et un bouton de plus. Les noms de lieux et d'ASBC ne se traduisent pas.

`index.html` est autonome (aucune connexion nécessaire après chargement des polices) :
il s'ouvre dans un navigateur ou dans une WebView Android (`file:///android_asset/index.html`).
Il contient la liste nominative des ASBC : il est exclu du dépôt (`.gitignore`).

## Anomalies trouvées dans le XLSForm

- 8 questions d'observation PCIME-c (`L_agent_de_sant_base_commun`, `_00`, `_001` à `_007`)
  ont les choix `oui` / `non`, mais leurs conditions et calculs testent `'1'` et `'2'` :
  dans Kobo, la liste détaillée ne s'affiche jamais et le score reste vide. Corrigé dans le prototype.
- `score_sup_vit_d` teste `demande_l_ge_de_l_enfant_` (tiret bas en trop). Corrigé dans le prototype.
- `score_sd_nn` compte `sdnn_ecoulement_pus_yeux`, qui n'existe pas dans `signes_danger_nn_list` :
  le score maximal n'est pas atteignable. À corriger dans Kobo.
- `score_evaluation`, `score_classification`, `score_traitement` font `sum()` sur des réponses
  `oui` / `non` : le résultat est NaN. Il faut un calcul `if(${...} = 'oui', 1, 0)` dans la
  répétition, puis `sum()` de ce calcul. À corriger dans Kobo.
- `Quels_sont_les_signe_z_les_5_a` a un message de contrainte mais pas de contrainte.

## Fichiers

- `app.html` : l'application (gabarit, le formulaire y est injecté par `build.py`).
- `build.py` : conversion XLSForm → JSON, contrôle des codes, génération de `index.html`, XLSForm bilingue.
- `traduction_en.json` : traduction anglaise du formulaire.
