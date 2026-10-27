# DermaSuivi : suivi photo de la cicatrisation

Application installable sur téléphone (Android, iPhone) et ordinateur, qui remplace le dossier
« un album par patient » de la galerie photo :

- **un dossier par patient** (nom, n° de dossier, notes), recherche, tri récent / A→Z ;
- **prendre une photo** directement ou **importer** depuis la galerie (plusieurs à la fois) ;
  la date de prise de vue est lue automatiquement dans la photo et reste modifiable ;
- **zones / lésions** (ex. « jambe droite ») pour suivre plusieurs lésions chez un même patient ;
- **frise chronologique** avec le jour de suivi : J0, J+14, J+49… ;
- **comparaison côte à côte** de 2 à 4 photos, bouton « première / dernière photo »,
  et **curseur avant / après** qui superpose deux photos ;
- **image de comparaison** (photos + dates) à partager ou enregistrer, par exemple pour le patient ;
- **fonctionne hors ligne** ; **sauvegarde / restauration** dans un fichier pour changer d'appareil.

## Confidentialité

Les photos restent **uniquement sur l'appareil** (IndexedDB du navigateur) : rien n'est envoyé sur
internet. Les fichiers de sauvegarde contiennent des données de santé : à conserver en lieu sûr.
Sur iPhone, installer l'app sur l'écran d'accueil évite que Safari efface les données d'un site
inutilisé.

## Installer

Adresse après publication : `https://actionplantracker23-ship-it.github.io/ROI-tools/dermasuivi/`

- **iPhone / iPad** : ouvrir l'adresse dans Safari → Partager → « Sur l'écran d'accueil ».
- **Android** : Chrome → menu ⋮ → « Installer l'application ».
- **Ordinateur** : Chrome ou Edge → icône d'installation dans la barre d'adresse.

## Développement

Aucune dépendance ni compilation : HTML, CSS et JavaScript.

```sh
cd dermasuivi && python3 -m http.server 8000   # puis http://localhost:8000
```

`index.html` (page), `app.js` (logique, base IndexedDB), `style.css`, `sw.js` (hors ligne),
`manifest.webmanifest` et `icons/` (installation).
