// Démonstration du moteur en ligne de commande (jalon 3).
//
//   npm run demo -- "Écris à jean.dupont@example.com, tel 06 12 34 56 78"
//   echo "Dossier Dupont SA" | npm run demo -- --dir annuaire.csv
//
// Options : --dir <fichier .json ou .csv>   annuaire à utiliser
//           --domain <domaine>             domaine interne à masquer (répétable)
//
// Les jetons [CATEGORIE_N] de ce script sont un simple aperçu : la pseudonymisation
// réversible complète arrive au jalon 4.

import { readFileSync } from 'node:fs';
import { createDetectors } from '../src/core/detectors';
import { compileDirectory, type DirectoryEntry } from '../src/core/directory';
import { importCsv, importJson } from '../src/core/directory-io';
import { analyze } from '../src/core/engine';

const args = process.argv.slice(2);
const words: string[] = [];
const domains: string[] = [];
let directoryFile: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i] ?? '';
  if (arg === '--dir') directoryFile = args[++i];
  else if (arg === '--domain') domains.push(args[++i] ?? '');
  else words.push(arg);
}

let text: string;
if (words.length > 0) {
  text = words.join(' ');
} else if (process.stdin.isTTY) {
  console.error('Usage : npm run demo -- "texte à nettoyer" [--dir annuaire.json|csv] [--domain entreprise.local]');
  process.exit(1);
} else {
  text = readFileSync(0, 'utf8');
}

let entries: DirectoryEntry[] = [];
if (directoryFile) {
  const content = readFileSync(directoryFile, 'utf8');
  const result = directoryFile.toLowerCase().endsWith('.csv') ? importCsv(content) : importJson(content);
  entries = result.entries;
  for (const error of result.errors) console.error(`Annuaire, ligne ${error.line} : ${error.message}`);
  console.error(`Annuaire : ${entries.length} entrée(s) chargée(s).\n`);
}

const matches = analyze(text, {
  detectors: createDetectors({ internalDomains: domains }),
  directory: compileDirectory(entries),
});

// Aperçu des jetons : un numéro par valeur distincte (sans tenir compte de la casse) et par catégorie.
const numbers = new Map<string, number>();
const counters = new Map<string, number>();
const tokenFor = (category: string, value: string): string => {
  const key = `${category}|${value.toLowerCase()}`;
  let n = numbers.get(key);
  if (n === undefined) {
    n = (counters.get(category) ?? 0) + 1;
    counters.set(category, n);
    numbers.set(key, n);
  }
  return `[${category}_${n}]`;
};

let cleaned = '';
let position = 0;
const rows: string[] = [];
for (const m of matches) {
  const token = tokenFor(m.category, m.value);
  cleaned += text.slice(position, m.start) + token;
  position = m.end;
  rows.push(`  ${token.padEnd(16)} ← ${m.value}`);
}
cleaned += text.slice(position);

console.log('--- Texte nettoyé ---');
console.log(cleaned);
console.log(`\n--- ${matches.length} élément(s) masqué(s) ---`);
if (rows.length > 0) console.log([...new Set(rows)].join('\n'));
