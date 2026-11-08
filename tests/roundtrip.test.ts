import { describe, expect, it } from 'vitest';
import { compileDirectory } from '../src/core/directory';
import { analyze } from '../src/core/engine';
import { TokenSession } from '../src/core/pseudonymize';
import { buildCorpus, corpusDirectory } from './helpers/corpus';

const directory = compileDirectory(corpusDirectory());

describe('aller-retour sur un corpus de 100 textes variés', () => {
  const corpus = buildCorpus(100, 42);

  it('contient 100 textes variés', () => {
    expect(corpus).toHaveLength(100);
    expect(new Set(corpus.map((c) => c.text)).size).toBeGreaterThan(90);
    expect(corpus.filter((c) => c.sensitive.length >= 3).length).toBeGreaterThan(50);
  });

  it('restore(clean(texte)) === texte pour chaque texte (session neuve)', () => {
    for (const [i, item] of corpus.entries()) {
      const session = new TokenSession();
      const cleaned = session.clean(item.text, analyze(item.text, { directory }));
      expect(session.restore(cleaned.text).text, `texte #${i}`).toBe(item.text);
    }
  });

  it('restore(clean(texte)) === texte avec une session partagée par tous les textes', () => {
    const shared = buildCorpus(100, 7, false); // sans faux jetons : ils sont ambigus dans une session partagée
    const session = new TokenSession();
    const cleanedTexts = shared.map((item) => session.clean(item.text, analyze(item.text, { directory })).text);
    shared.forEach((item, i) => {
      expect(session.restore(cleanedTexts[i] ?? '').text, `texte #${i}`).toBe(item.text);
    });
  });

  it('ne laisse survivre aucune valeur sensible dans le texte nettoyé', () => {
    for (const [i, item] of corpus.entries()) {
      const cleaned = new TokenSession().clean(item.text, analyze(item.text, { directory })).text;
      for (const value of item.sensitive) {
        expect(cleaned.includes(value), `texte #${i} : « ${value} » n'a pas été masqué`).toBe(false);
      }
    }
  });

  it('chaque réponse d\'IA simulée est restaurée sans résidu de jeton', () => {
    for (const [i, item] of corpus.entries()) {
      const session = new TokenSession();
      const cleaned = session.clean(item.text, analyze(item.text, { directory }));
      const reply = `Voici un résumé.\n> ${cleaned.text}\nFin.`;
      const restored = session.restore(reply);
      expect(restored.text, `texte #${i}`).toBe(`Voici un résumé.\n> ${item.text}\nFin.`);
      expect(restored.missing, `texte #${i}`).toEqual([]);
    }
  });
});

describe('texte avec jetons lookalikes', () => {
  it('conserve tels quels les faux jetons du texte d\'origine', () => {
    const text = 'Voir [CLIENT_1] et EMAIL_2. Écrire à jean.dupont@example.com (Dupont SA).';
    const session = new TokenSession();
    const cleaned = session.clean(text, analyze(text, { directory }));
    expect(cleaned.text).toContain('[CLIENT_1]');
    expect(cleaned.text).not.toContain('Dupont SA');
    expect(cleaned.text).not.toContain('jean.dupont@example.com');
    expect(session.restore(cleaned.text).text).toBe(text);
  });
});
