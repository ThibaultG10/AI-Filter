// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '../src/ui/app';
import { Storage, type KeyValueStore } from '../src/ui/storage';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} introuvable`);
  return el as T;
};
const click = (id: string): void => $(id).click();
const flush = () => new Promise((r) => setTimeout(r, 20));

let store: ReturnType<typeof memoryStore>;
function start() {
  document.body.innerHTML = '<div id="app"></div>';
  return mount($('app'), { storage: new Storage(store), iterations: 1_000, lang: 'fr' });
}

beforeEach(() => {
  store = memoryStore();
  start();
});

describe('interface : structure et accessibilité', () => {
  it('affiche le bandeau permanent et un titre principal', () => {
    expect(document.querySelector('h1')?.textContent).toContain('Filtre IA');
    expect(document.querySelector('.banner')?.textContent).toContain('pas de garantie absolue');
  });

  it('chaque champ a une étiquette associée', () => {
    for (const id of ['input', 'reply', 'cleaned', 'restored', 'domains', 'dir-term', 'dir-category', 'dir-aliases', 'passphrase']) {
      expect(document.querySelector(`label[for="${id}"]`), id).not.toBeNull();
    }
    expect($('mask-category').getAttribute('aria-label') ?? document.querySelector('label[for="mask-category"]')).toBeTruthy();
  });

  it('les zones de statut sont annoncées', () => {
    expect($('counter').getAttribute('aria-live')).toBe('polite');
    for (const id of ['input-status', 'cleaned-status', 'report']) expect($(id).getAttribute('role')).toBe('status');
  });

  it('aucun style ni script en ligne', () => {
    expect(document.querySelectorAll('[style], script').length).toBe(0);
  });
});

describe('interface : parcours complet', () => {
  it('analyse, valide, copie le texte nettoyé puis restaure la réponse', () => {
    $<HTMLTextAreaElement>('input').value = 'Mail : jean@example.com / tel 06 12 34 56 78';
    click('analyze');
    expect($('review').hidden).toBe(false);
    expect($('counter').textContent).toBe('2 éléments masqués');
    expect(document.querySelectorAll('button.mark')).toHaveLength(2);

    click('validate');
    expect($<HTMLTextAreaElement>('cleaned').value).toBe('Mail : [EMAIL_1] / tel [TEL_1]');
    expect($<HTMLButtonElement>('copy-cleaned').disabled).toBe(false);
    expect($('session-info').textContent).toContain('2 jetons');

    $<HTMLTextAreaElement>('reply').value = 'Écrivez à [EMAIL_1] ou appelez [tel_1]. Contact [EMAIL_9].';
    click('restore');
    expect($<HTMLTextAreaElement>('restored').value).toBe('Écrivez à jean@example.com ou appelez 06 12 34 56 78. Contact [EMAIL_9].');
    expect($('report').textContent).toContain('2 jetons restaurés');
    expect($('report').textContent).toContain('EMAIL_9');
  });

  it('refuse d\'analyser un texte vide', () => {
    click('analyze');
    expect($('input-status').textContent).toContain('Collez');
    expect($('review').hidden).toBe(true);
  });

  it('un clic sur un élément le démasque, avec état annoncé, puis le remasque', () => {
    $<HTMLTextAreaElement>('input').value = 'a@x.fr et 06 12 34 56 78';
    click('analyze');
    const mark = document.querySelector<HTMLButtonElement>('button.mark')!;
    expect(mark.getAttribute('aria-pressed')).toBe('true');
    mark.click();
    expect(document.querySelector('button.mark.unmasked')).not.toBeNull();
    expect($('counter').textContent).toContain('1 élément masqué');
    expect($('counter').textContent).toContain('1 conservé tel quel');
    click('validate');
    expect($<HTMLTextAreaElement>('cleaned').value).toBe('a@x.fr et [TEL_1]');
    document.querySelector<HTMLButtonElement>('button.mark')!.click();
    expect($('counter').textContent).toBe('2 éléments masqués');
    expect($<HTMLTextAreaElement>('cleaned').value).toBe(''); // résultat périmé effacé
  });

  it('modifier le texte après l\'analyse bloque la validation', () => {
    const input = $<HTMLTextAreaElement>('input');
    input.value = 'a@x.fr';
    click('analyze');
    input.value = 'a@x.fr et b@x.fr';
    input.dispatchEvent(new Event('input'));
    expect($<HTMLButtonElement>('validate').disabled).toBe(true);
    expect($('input-status').textContent).toContain('relancez');
    click('analyze');
    expect($<HTMLButtonElement>('validate').disabled).toBe(false);
  });

  it('affiche les valeurs dans l\'aperçu sans interpréter de HTML', () => {
    $<HTMLTextAreaElement>('input').value = '<img src=x onerror=alert(1)> a@x.fr';
    click('analyze');
    expect(document.querySelector('#preview img')).toBeNull();
    expect($('preview').textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('restaurer sans jeton de session explique quoi faire', () => {
    $<HTMLTextAreaElement>('reply').value = '[EMAIL_1]';
    click('restore');
    expect($('report').textContent).toContain('Aucun jeton');
  });
});

describe('interface : masquage manuel', () => {
  it('masque la sélection partout et sans l\'ajouter à l\'annuaire par défaut', () => {
    const input = $<HTMLTextAreaElement>('input');
    input.value = 'Projet Phénix et projet phénix';
    input.setSelectionRange(0, 13);
    $<HTMLInputElement>('mask-category').value = 'PROJET';
    click('mask-selection');
    expect(document.querySelectorAll('button.mark')).toHaveLength(2);
    expect(store.data.has('filtre-ia/directory/v1')).toBe(false);
    click('validate');
    expect($<HTMLTextAreaElement>('cleaned').value).toBe('[PROJET_1] et [PROJET_1]');
  });

  it('peut ajouter la sélection à l\'annuaire permanent', () => {
    const input = $<HTMLTextAreaElement>('input');
    input.value = 'Dupont SA';
    input.setSelectionRange(0, 9);
    $<HTMLInputElement>('mask-permanent').checked = true;
    click('mask-selection');
    expect($('dir-list').textContent).toContain('Dupont SA');
    expect(store.data.get('filtre-ia/directory/v1')).toContain('Dupont SA');
  });

  it('demande une sélection', () => {
    $<HTMLTextAreaElement>('input').value = 'texte';
    click('mask-selection');
    expect($('input-status').textContent).toContain('Sélectionnez');
  });
});

describe('interface : annuaire', () => {
  it('ajoute, liste, retire et sauvegarde', () => {
    $<HTMLInputElement>('dir-term').value = 'Dupont SA';
    $<HTMLInputElement>('dir-aliases').value = 'Dupont | Dupont S.A.';
    click('dir-add');
    expect($('dir-list').textContent).toContain('Dupont SA');
    expect($('dir-list').textContent).toContain('Dupont S.A.');
    expect(store.data.get('filtre-ia/directory/v1')).toContain('Dupont SA');
    $<HTMLInputElement>('dir-term').value = '';
    click('dir-add');
    expect($('dir-status').classList.contains('error')).toBe(true);
    document.querySelector<HTMLButtonElement>('#dir-list button')!.click();
    expect($('dir-list').children).toHaveLength(0);
  });

  it('recharge l\'annuaire sauvegardé au démarrage', () => {
    $<HTMLInputElement>('dir-term').value = 'Dupont SA';
    click('dir-add');
    start();
    expect($('dir-list').textContent).toContain('Dupont SA');
  });

  it('importe un fichier CSV et signale les lignes en erreur', async () => {
    const file = new File(['terme;categorie;alias\nDupont SA;CLIENT;\nX;CLIENT;\n'], 'a.csv', { type: 'text/csv' });
    const fileInput = $<HTMLInputElement>('dir-import');
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change'));
    await flush();
    expect($('dir-list').textContent).toContain('Dupont SA');
    expect($('dir-status').textContent).toContain('1 ajoutée');
    expect($('dir-status').textContent).toContain('Ligne');
  });
});

describe('interface : réglages', () => {
  it('désactive un détecteur et mémorise le réglage', () => {
    const box = $<HTMLInputElement>('det-email');
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(store.data.get('filtre-ia/settings/v1')).toContain('"email":false');
    $<HTMLTextAreaElement>('input').value = 'a@x.fr';
    click('analyze');
    expect(document.querySelectorAll('button.mark')).toHaveLength(0);
    expect($('counter').textContent).toBe('0 élément masqué');
  });

  it('active la détection d\'URL internes avec un domaine', () => {
    const domains = $<HTMLTextAreaElement>('domains');
    domains.value = 'entreprise.local';
    domains.dispatchEvent(new Event('change'));
    expect($<HTMLInputElement>('det-internal-url').checked).toBe(true);
    $<HTMLTextAreaElement>('input').value = 'voir https://wiki.entreprise.local/x';
    click('analyze');
    expect(document.querySelectorAll('button.mark')).toHaveLength(1);
  });
});

describe('interface : session chiffrée et effacement', () => {
  async function validateSample() {
    $<HTMLTextAreaElement>('input').value = 'jean@example.com';
    click('analyze');
    click('validate');
  }

  it('refuse une phrase de passe trop courte', async () => {
    await validateSample();
    $<HTMLInputElement>('passphrase').value = 'court';
    click('session-save');
    await flush();
    expect($('session-status').textContent).toContain('au moins');
    expect(store.data.has('filtre-ia/session/v1')).toBe(false);
  });

  it('enregistre chiffrée puis recharge dans une nouvelle visite', async () => {
    await validateSample();
    $<HTMLInputElement>('passphrase').value = 'phrase de passe';
    click('session-save');
    await flush();
    const saved = store.data.get('filtre-ia/session/v1');
    expect(saved).toBeTruthy();
    expect(saved).not.toContain('jean@example.com');

    start();
    $<HTMLInputElement>('passphrase').value = 'mauvaise phrase';
    click('session-load');
    await flush();
    expect($('session-status').classList.contains('error')).toBe(true);
    $<HTMLInputElement>('passphrase').value = 'phrase de passe';
    click('session-load');
    await flush();
    expect($('session-info').textContent).toContain('1 jeton');
    $<HTMLTextAreaElement>('reply').value = 'Écrire à [EMAIL_1]';
    click('restore');
    expect($<HTMLTextAreaElement>('restored').value).toBe('Écrire à jean@example.com');
  });

  it('« Nouvelle session » efface les jetons', async () => {
    await validateSample();
    click('session-new');
    expect($('session-info').textContent).toContain('0 jeton');
  });

  it('« Tout effacer » vide le stockage et les listes', async () => {
    $<HTMLInputElement>('dir-term').value = 'Dupont SA';
    click('dir-add');
    await validateSample();
    $<HTMLInputElement>('passphrase').value = 'phrase de passe';
    click('session-save');
    await flush();
    click('wipe');
    expect(store.data.size).toBe(0);
    expect($('dir-list').children).toHaveLength(0);
    expect($('session-info').textContent).toContain('0 jeton');
  });
});
