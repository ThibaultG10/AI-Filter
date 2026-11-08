// Test de bout en bout dans un vrai Chrome sur le fichier unique (file://).
// Vérifie le parcours complet ET qu'aucune requête réseau n'est tentée.
// Usage : npm run build:single && npm run e2e   (CHROME_PATH pour choisir le navigateur)

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const file = resolve('dist-single/filtre-ia.html');
if (!existsSync(file)) throw new Error('Lancez d\'abord : npm run build:single');

const candidates = [process.env['CHROME_PATH'], '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = candidates.find((p): p is string => !!p && existsSync(p));

const failures: string[] = [];
const check = (ok: boolean, label: string): void => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
  if (!ok) failures.push(label);
};

const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
  const requests: string[] = [];
  const problems: string[] = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    requests.push(url);
    return url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
  });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error('CSP violation: ' + e.violatedDirective));
  });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(String(e)));

  await page.goto(pathToFileURL(file).href);
  check((await page.title()) === 'Filtre IA', 'la page se charge depuis file://');
  check((await page.locator('.banner').textContent())?.includes('pas de garantie absolue') === true, 'bandeau d\'avertissement visible');

  const original =
    'Bonjour, écrire à jean.dupont@example.com ou au 06 12 34 56 78. IBAN FR76 3000 6000 0112 3456 7890 189. Serveur 192.168.1.14.';
  await page.fill('#input', original);
  await page.click('#analyze');
  check((await page.locator('#counter').textContent()) === '4 éléments masqués', '4 éléments détectés');
  await page.click('#validate');
  const cleaned = await page.inputValue('#cleaned');
  check(!/jean\.dupont|06 12|FR76|192\.168/.test(cleaned), 'aucune donnée sensible dans le texte nettoyé');
  check(/\[EMAIL_1\].*\[TEL_1\].*\[IBAN_1\].*\[IP_1\]/.test(cleaned), 'jetons attendus présents');

  await page.fill('#reply', cleaned.replace('Bonjour', 'Salut'));
  await page.click('#restore');
  check((await page.inputValue('#restored')) === original.replace('Bonjour', 'Salut'), 'restauration exacte');

  // Annuaire : ajout puis export (téléchargement local).
  await page.click('#directory summary');
  await page.fill('#dir-term', 'Dupont SA');
  await page.click('#dir-add');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#dir-export-json')]);
  check(download.suggestedFilename() === 'annuaire.json', 'export JSON de l\'annuaire');

  // Session chiffrée : enregistrer puis recharger la page et recharger la session.
  await page.click('#session summary');
  await page.fill('#passphrase', 'phrase de passe e2e');
  await page.click('#session-save');
  await page.waitForFunction(() => document.getElementById('session-status')?.textContent?.includes('enregistrée'), null, { timeout: 15000 });
  await page.reload();
  await page.click('#session summary');
  await page.fill('#passphrase', 'phrase de passe e2e');
  await page.click('#session-load');
  await page.waitForFunction(() => document.getElementById('session-status')?.textContent?.includes('chargée'), null, { timeout: 15000 });
  await page.fill('#reply', 'Contact : [EMAIL_1]');
  await page.click('#restore');
  check((await page.inputValue('#restored')) === 'Contact : jean.dupont@example.com', 'session chiffrée rechargée après rechargement de la page');
  check((await page.inputValue('#restored')).length > 0, 'restauration depuis la session rechargée');

  const external = requests.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:'));
  check(external.length === 0, `aucune requête réseau (${requests.length} requêtes locales)`);
  check(problems.length === 0, `aucune erreur console ni violation CSP${problems.length ? ' : ' + problems.join(' | ') : ''}`);
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nTous les contrôles e2e sont passés.');
