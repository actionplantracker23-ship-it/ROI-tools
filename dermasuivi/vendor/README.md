# Bibliothèques intégrées

- `anthropic-sdk-1.1.0.mjs` : SDK officiel Anthropic (`@anthropic-ai/sdk` 1.1.0, licence Apache-2.0,
  voir `anthropic-sdk-LICENSE.txt`), regroupé en un seul fichier pour le navigateur :

  ```sh
  npm install @anthropic-ai/sdk@1.1.0 esbuild@0.24.0
  echo "export { default } from '@anthropic-ai/sdk';" > entry.mjs
  npx esbuild entry.mjs --bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=eof --outfile=anthropic-sdk-1.1.0.mjs
  ```

  Il n'est chargé qu'au moment d'une analyse IA. Intégré à l'application plutôt que chargé depuis un CDN :
  aucun service tiers n'est contacté en dehors de l'API d'Anthropic.
