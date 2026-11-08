import { describe, expect, it } from 'vitest';
import { AppModel } from '../src/ui/model';
import { Storage, type KeyValueStore } from '../src/ui/storage';

const TEXT = 'Écrire à jean@example.com ou au 06 12 34 56 78. Client : Dupont SA. Encore jean@example.com.';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('AppModel : analyse et validation', () => {
  it('détecte, masque et nettoie', () => {
    const m = new AppModel();
    m.addTerm('Dupont SA', 'CLIENT', false);
    const items = m.analyze(TEXT);
    expect(items.map((i) => i.match.value)).toEqual(['jean@example.com', '06 12 34 56 78', 'Dupont SA', 'jean@example.com']);
    expect(m.maskedCount()).toBe(4);
    const cleaned = m.validate();
    expect(cleaned?.text).toBe('Écrire à [EMAIL_1] ou au [TEL_1]. Client : [CLIENT_1]. Encore [EMAIL_1].');
    expect(m.restore('Merci [CLIENT_1] ! ([EMAIL_1])').text).toBe('Merci Dupont SA ! (jean@example.com)');
  });

  it('ne nettoie que le texte analysé, jamais un texte modifié depuis', () => {
    const m = new AppModel();
    m.analyze('a@x.fr');
    expect(m.validate()?.text).toBe('[EMAIL_1]');
    expect(m.analyzedText).toBe('a@x.fr');
  });

  it('validate renvoie null avant toute analyse', () => {
    expect(new AppModel().validate()).toBeNull();
  });

  it('démasquer une valeur la conserve partout (faux positif) et se réactive', () => {
    const m = new AppModel();
    const items = m.analyze(TEXT);
    const mail = items[0]!;
    m.toggleValue(mail.key);
    expect(m.review().filter((r) => !r.masked)).toHaveLength(2);
    expect(m.validate()?.text).toBe('Écrire à jean@example.com ou au [TEL_1]. Client : Dupont SA. Encore jean@example.com.');
    m.toggleValue(mail.key);
    expect(m.maskedCount()).toBe(3);
  });

  it('une valeur démasquée le reste après une nouvelle analyse', () => {
    const m = new AppModel();
    const [first] = m.analyze(TEXT);
    m.toggleValue(first!.key);
    expect(m.analyze(TEXT).filter((r) => !r.masked)).toHaveLength(2);
  });

  it('le masquage manuel couvre toutes les occurrences, sans tenir compte de la casse', () => {
    const m = new AppModel();
    expect(m.addTerm('Projet Phénix', 'projet', false)).toEqual({ ok: true });
    m.analyze('Le projet phenix et le PROJET PHÉNIX.');
    expect(m.validate()?.text).toBe('Le [PROJET_1] et le [PROJET_1].');
  });

  it('refuse un terme vide, trop court ou déjà présent', () => {
    const m = new AppModel();
    expect(m.addTerm('', 'X', false).ok).toBe(false);
    expect(m.addTerm('a', 'X', false).ok).toBe(false);
    expect(m.addTerm('Dupont', 'CLIENT', true).ok).toBe(true);
    expect(m.addTerm('dupont', 'CLIENT', false).ok).toBe(false);
  });

  it('les termes temporaires ne vont pas dans l\'annuaire permanent', () => {
    const m = new AppModel();
    m.addTerm('Secret', 'INTERNE', false);
    m.addTerm('Public', 'INTERNE', true);
    expect(m.directory.map((e) => e.term)).toEqual(['Public']);
    expect(m.temporary.map((e) => e.term)).toEqual(['Secret']);
  });

  it('ajouter un terme précédemment démasqué le masque de nouveau', () => {
    const m = new AppModel();
    const [item] = m.analyze('a@x.fr');
    m.toggleValue(item!.key);
    expect(m.maskedCount()).toBe(0);
    m.addTerm('a@x.fr', 'EMAIL', false);
    m.analyze('a@x.fr');
    expect(m.maskedCount()).toBe(1);
  });
});

describe('AppModel : réglages', () => {
  it('désactiver un détecteur retire ses correspondances', () => {
    const m = new AppModel({ enabled: { email: false }, internalDomains: [] });
    expect(m.analyze('a@x.fr 06 12 34 56 78').map((i) => i.match.category)).toEqual(['TEL']);
  });

  it('les domaines internes activent la détection d\'URL internes', () => {
    const m = new AppModel({ enabled: {}, internalDomains: ['entreprise.local'] });
    expect(m.analyze('voir https://wiki.entreprise.local/page').map((i) => i.match.category)).toEqual(['URL_INTERNE']);
  });
});

describe('AppModel : annuaire', () => {
  it('importe du JSON et du CSV, sans doublons, en signalant les erreurs', () => {
    const m = new AppModel();
    const r1 = m.importDirectory('terme;categorie;alias\nDupont SA;CLIENT;Dupont\nX;CLIENT;\n', 'a.csv');
    expect(r1.added).toBe(1);
    expect(r1.errors).toHaveLength(1);
    const r2 = m.importDirectory(m.exportDirectory('json'), 'a.json');
    expect(r2.added).toBe(0);
    expect(r2.skipped).toBe(1);
    expect(m.importDirectory('pas du json', 'x.json').errors.length).toBeGreaterThan(0);
  });

  it('exporte en CSV et en JSON', () => {
    const m = new AppModel();
    m.addTerm('Dupont SA', 'CLIENT', true, ['Dupont']);
    expect(m.exportDirectory('csv')).toContain('Dupont SA');
    expect(JSON.parse(m.exportDirectory('json'))).toBeTruthy();
  });

  it('retire une entrée', () => {
    const m = new AppModel();
    m.addTerm('Dupont', 'CLIENT', true);
    m.removeEntry(0);
    expect(m.directory).toEqual([]);
  });
});

describe('Storage', () => {
  it('sauvegarde et recharge réglages et annuaire', () => {
    const store = memoryStore();
    const s = new Storage(store);
    s.saveSettings({ enabled: { email: false }, internalDomains: ['x.local'] });
    s.saveDirectory([{ term: 'Dupont', category: 'CLIENT', aliases: ['Dup'] }]);
    const again = new Storage(store);
    expect(again.loadSettings()).toEqual({ enabled: { email: false }, internalDomains: ['x.local'] });
    expect(again.loadDirectory()).toEqual([{ term: 'Dupont', category: 'CLIENT', aliases: ['Dup'] }]);
  });

  it('ignore des données corrompues', () => {
    const store = memoryStore();
    store.setItem('filtre-ia/settings/v1', '{pas du json');
    store.setItem('filtre-ia/directory/v1', 'xx');
    const s = new Storage(store);
    expect(s.loadSettings()).toEqual({ enabled: {}, internalDomains: [] });
    expect(s.loadDirectory()).toEqual([]);
  });

  it('fonctionne sans stockage ou avec un stockage qui lève des erreurs', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
      removeItem: () => {
        throw new Error('bloqué');
      },
    };
    for (const s of [new Storage(null), new Storage(broken)]) {
      expect(s.saveSettings({ enabled: {}, internalDomains: [] })).toBe(false);
      expect(s.loadDirectory()).toEqual([]);
      expect(s.loadEncryptedSession()).toBeNull();
      expect(() => s.clearAll()).not.toThrow();
    }
  });

  it('efface tout', () => {
    const store = memoryStore();
    const s = new Storage(store);
    s.saveSettings({ enabled: {}, internalDomains: [] });
    s.saveEncryptedSession('x');
    s.clearAll();
    expect(store.data.size).toBe(0);
  });
});
