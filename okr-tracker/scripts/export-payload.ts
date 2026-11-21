/**
 * Produit le JSON attendu par la fonction SQL import_dataset() à partir d'un classeur.
 * Utile pour un premier chargement en ligne de commande, ou pour tester le schéma :
 *   npx tsx scripts/export-payload.ts classeur.xlsx > payload.json
 *   psql … -c "select import_dataset(pg_read_file('payload.json')::jsonb)"   (en tant qu'admin)
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { parseWorkbook } from '../src/lib/import/excel';
import { toImportPayload } from '../src/lib/store/supabaseStore';

const file = process.argv[2];
if (!file) throw new Error('Chemin du fichier .xlsx attendu');
process.stdout.write(JSON.stringify(toImportPayload(parseWorkbook(XLSX.read(readFileSync(file)), file).dataset)));
