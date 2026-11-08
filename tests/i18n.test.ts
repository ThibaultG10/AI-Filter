// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { detectLanguage, EN, FR, getTexts, LANGS } from '../src/config/texts';
import { createDetectors } from '../src/core/detectors';
import { normalizeCategory } from '../src/core/directory';
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
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('textes : cohérence FR / EN', () => {
  it('ont exactement les mêmes clés', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
  });

  it('chaque texte est non vide et les fonctions renvoient du texte', () => {
    for (const lang of LANGS) {
      const T = getTexts(lang);
      for (const [key, value] of Object.entries(T)) {
        if (typeof value === 'string') expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
        if (typeof value === 'function') {
          const fn = value as (...a: unknown[]) => unknown;
          const candidates: unknown[][] = [[2, 1, 0], [['A_1']], ['x', 'y'], ['x']];
          const outputs = candidates.flatMap((args) => {
            try {
              return [fn(...args)];
            } catch {
              return [];
            }
          });
          expect(outputs.some((o) => typeof o === 'string'), `${lang}.${key}`).toBe(true);
        }
      }
    }
  });

  it('chaque détecteur a un libellé dans chaque langue', () => {
    for (const d of createDetectors()) {
      expect(FR.detectorLabels[d.id], `fr ${d.id}`).toBeTruthy();
      expect(EN.detectorLabels[d.id], `en ${d.id}`).toBeTruthy();
    }
  });

  it('les noms de catégories affichés sont des catégories valides', () => {
    for (const shown of [...Object.values(EN.categories), ...EN.defaultCategories]) {
      expect(normalizeCategory(shown), shown).toBe(shown);
    }
  });

  it('les catégories de tous les détecteurs ont un nom en anglais ou sont neutres', () => {
    for (const d of createDetectors()) {
      const shown = EN.categories[d.category] ?? d.category;
      expect(shown).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(shown).not.toMatch(/^(CLE|CARTE|TEL|PERSONNE|PROJET|SERVEUR|INTERNE)\b/);
    }
  });
});

describe('detectLanguage', () => {
  it.each([
    [['fr-FR'], 'fr'],
    [['fr'], 'fr'],
    [['FR-ca', 'en'], 'fr'],
    [['en-US'], 'en'],
    [['de-DE'], 'en'],
    [[], 'en'],
    [undefined, 'en'],
  ])('%j → %s', (langs, expected) => {
    expect(detectLanguage(langs as string[] | undefined)).toBe(expected);
  });
});

describe('interface bilingue', () => {
  let store: ReturnType<typeof memoryStore>;
  const start = (lang?: 'fr' | 'en') => {
    document.body.innerHTML = '<div id="app"></div>';
    return mount($('app'), { storage: new Storage(store), iterations: 1_000, ...(lang ? { lang } : {}) });
  };
  beforeEach(() => {
    store = memoryStore();
  });

  it('affiche l\'anglais, y compris le bandeau et la langue du document', () => {
    start('en');
    expect(document.documentElement.lang).toBe('en');
    expect($('analyze').textContent).toBe('Analyze');
    expect(document.querySelector('.banner')?.textContent).toContain('not an absolute guarantee');
    expect($('det-phone-us')).not.toBeNull();
  });

  it('les jetons utilisent les catégories anglaises', () => {
    start('en');
    $<HTMLTextAreaElement>('input').value = 'Call 06 12 34 56 78 or write to a@x.fr';
    $('analyze').click();
    $('validate').click();
    expect($<HTMLTextAreaElement>('cleaned').value).toBe('Call [PHONE_1] or write to [EMAIL_1]');
    expect($('preview').textContent).toContain('PHONE');
  });

  it('changer de langue garde le texte, l\'analyse et la session', () => {
    start('fr');
    $<HTMLTextAreaElement>('input').value = 'tel 06 12 34 56 78';
    $('analyze').click();
    $('validate').click();
    const select = $<HTMLSelectElement>('lang');
    select.value = 'en';
    select.dispatchEvent(new Event('change'));
    expect($('analyze').textContent).toBe('Analyze');
    expect($<HTMLTextAreaElement>('input').value).toBe('tel 06 12 34 56 78');
    expect($<HTMLTextAreaElement>('cleaned').value).toBe('tel [TEL_1]');
    expect($('review').hidden).toBe(false);
    expect($('session-info').textContent).toContain('1 token');
    // la restauration du jeton créé en français fonctionne toujours en anglais
    $<HTMLTextAreaElement>('reply').value = 'Call [TEL_1]';
    $('restore').click();
    expect($<HTMLTextAreaElement>('restored').value).toBe('Call 06 12 34 56 78');
  });

  it('mémorise la langue choisie et la retrouve au démarrage', () => {
    start('fr');
    const select = $<HTMLSelectElement>('lang');
    select.value = 'en';
    select.dispatchEvent(new Event('change'));
    start();
    expect($('analyze').textContent).toBe('Analyze');
    expect($<HTMLSelectElement>('lang').value).toBe('en');
  });

  it('« Tout effacer » efface aussi la langue mémorisée', async () => {
    start('fr');
    const select = $<HTMLSelectElement>('lang');
    select.value = 'en';
    select.dispatchEvent(new Event('change'));
    $('wipe').click();
    await flush();
    expect(store.data.size).toBe(0);
  });

  it('le sélecteur de langue est étiqueté', () => {
    start('en');
    expect($('lang').getAttribute('aria-label')).toBe('Language');
  });
});
