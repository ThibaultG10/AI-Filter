import { readFileSync } from 'node:fs';
import { writeSingleFile } from './single-file';

const out = writeSingleFile('dist', 'dist-single/filtre-ia.html');
console.log(`Fichier unique écrit : ${out} (${(readFileSync(out).length / 1024).toFixed(1)} Ko)`);
