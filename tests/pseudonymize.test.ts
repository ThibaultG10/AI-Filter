import { describe, expect, it } from 'vitest';
import { TokenSession } from '../src/core/pseudonymize';
import type { Match } from '../src/core/types';

const m = (text: string, value: string, category: string, from = 0): Match => {
  const start = text.indexOf(value, from);
  if (start === -1) throw new Error(`« ${value} » introuvable`);
  return { start, end: start + value.length, value, category };
};

describe('TokenSession.clean : jetons stables', () => {
  it('numérote les valeurs distinctes par catégorie, dans l\'ordre d\'apparition', () => {
    const text = 'a@x.fr, b@x.fr, Dupont SA, 06 12 34 56 78';
    const s = new TokenSession();
    const r = s.clean(text, [m(text, 'a@x.fr', 'EMAIL'), m(text, 'b@x.fr', 'EMAIL'), m(text, 'Dupont SA', 'CLIENT'), m(text, '06 12 34 56 78', 'TEL')]);
    expect(r.text).toBe('[EMAIL_1], [EMAIL_2], [CLIENT_1], [TEL_1]');
  });

  it('une même valeur reçoit toujours le même jeton, sans tenir compte de la casse', () => {
    const text = 'Dupont puis DUPONT puis dupont';
    const s = new TokenSession();
    const r = s.clean(text, [m(text, 'Dupont', 'CLIENT'), m(text, 'DUPONT', 'CLIENT'), m(text, 'dupont', 'CLIENT')]);
    expect(r.text).toBe('[CLIENT_1] puis [CLIENT_1] puis [CLIENT_1]');
    expect(s.size).toBe(1);
  });

  it('ignore aussi les accents et la forme des espaces', () => {
    const text = 'Élodie Martin, Elodie  Martin';
    const s = new TokenSession();
    const r = s.clean(text, [m(text, 'Élodie Martin', 'PERSONNE'), m(text, 'Elodie  Martin', 'PERSONNE')]);
    expect(r.text).toBe('[PERSONNE_1], [PERSONNE_1]');
  });

  it('la même valeur dans deux catégories donne deux jetons', () => {
    const text = '10.0.0.1 10.0.0.1';
    const s = new TokenSession();
    const r = s.clean(text, [m(text, '10.0.0.1', 'IP'), m(text, '10.0.0.1', 'SERVEUR', 1)]);
    expect(r.text).toBe('[IP_1] [SERVEUR_1]');
  });

  it('garde les jetons d\'un appel à l\'autre dans la session', () => {
    const s = new TokenSession();
    const t1 = 'écrire à a@x.fr';
    const t2 = 'écrire à b@x.fr puis à a@x.fr';
    expect(s.clean(t1, [m(t1, 'a@x.fr', 'EMAIL')]).text).toBe('écrire à [EMAIL_1]');
    expect(s.clean(t2, [m(t2, 'b@x.fr', 'EMAIL'), m(t2, 'a@x.fr', 'EMAIL')]).text).toBe('écrire à [EMAIL_2] puis à [EMAIL_1]');
  });

  it('renvoie le détail des remplacements', () => {
    const text = 'Dupont SA';
    const r = new TokenSession().clean(text, [m(text, 'Dupont SA', 'CLIENT')]);
    expect(r.replacements).toEqual([{ token: '[CLIENT_1]', category: 'CLIENT', value: 'Dupont SA', start: 0, end: 9 }]);
  });

  it('sans correspondance, renvoie le texte inchangé', () => {
    const r = new TokenSession().clean('rien à masquer', []);
    expect(r).toEqual({ text: 'rien à masquer', replacements: [] });
  });

  it('ignore les correspondances invalides ou qui se chevauchent', () => {
    const text = 'abcdef ghij';
    const r = new TokenSession().clean(text, [
      { start: 0, end: 4, value: 'abcd', category: 'X' },
      { start: 2, end: 6, value: 'cdef', category: 'Y' }, // chevauche la précédente
      { start: 7, end: 7, value: '', category: 'Z' }, // vide
      { start: 8, end: 99, value: 'hors', category: 'Z' }, // hors du texte
    ]);
    expect(r.text).toBe('[X_1]ef ghij');
  });

  it('normalise la catégorie des correspondances', () => {
    const text = 'Dupont';
    expect(new TokenSession().clean(text, [{ start: 0, end: 6, value: 'Dupont', category: 'équipe interne' }]).text).toBe('[EQUIPE_INTERNE_1]');
    expect(new TokenSession().clean(text, [{ start: 0, end: 6, value: 'Dupont', category: '???' }]).text).toBe('[INTERNE_1]');
  });
});

describe('TokenSession.clean : jetons déjà présents dans le texte', () => {
  it('évite d\'attribuer un numéro qui existe déjà tel quel dans le texte', () => {
    const text = 'Ticket [EMAIL_1] : écrire à a@x.fr';
    const s = new TokenSession();
    const r = s.clean(text, [m(text, 'a@x.fr', 'EMAIL')]);
    expect(r.text).toBe('Ticket [EMAIL_1] : écrire à [EMAIL_2]');
    // le jeton d'origine n'est pas confondu avec un vrai jeton à la restauration
    const back = s.restore(r.text);
    expect(back.text).toBe(text);
    expect(back.unknown).toEqual(['EMAIL_1']);
  });

  it('évite aussi les jetons nus et les variantes (minuscules, espaces)', () => {
    const text = 'EMAIL_1 [ email_2 ] puis a@x.fr';
    const s = new TokenSession();
    expect(s.clean(text, [m(text, 'a@x.fr', 'EMAIL')]).text).toBe('EMAIL_1 [ email_2 ] puis [EMAIL_3]');
  });
});

describe('TokenSession : restauration', () => {
  it('restaure la réponse d\'une IA', () => {
    const text = 'Dupont SA a écrit à jean@example.com';
    const s = new TokenSession();
    s.clean(text, [m(text, 'Dupont SA', 'CLIENT'), m(text, 'jean@example.com', 'EMAIL')]);
    const r = s.restore('Réponse : [CLIENT_1] a bien contacté [EMAIL_1]. Voir aussi [CLIENT_5].');
    expect(r.text).toBe('Réponse : Dupont SA a bien contacté jean@example.com. Voir aussi [CLIENT_5].');
    expect(r.restored).toBe(2);
    expect(r.unknown).toEqual(['CLIENT_5']);
    expect(r.missing).toEqual([]);
  });

  it('restitue la première graphie rencontrée pour des variantes de casse (limite documentée)', () => {
    const text = 'Dupont puis DUPONT';
    const s = new TokenSession();
    const cleaned = s.clean(text, [m(text, 'Dupont', 'CLIENT'), m(text, 'DUPONT', 'CLIENT')]);
    expect(s.restore(cleaned.text).text).toBe('Dupont puis Dupont');
  });
});

describe('TokenSession : contenu, effacement, sérialisation', () => {
  const build = () => {
    const text = 'Dupont SA, a@x.fr, b@x.fr';
    const s = new TokenSession();
    s.clean(text, [m(text, 'Dupont SA', 'CLIENT'), m(text, 'a@x.fr', 'EMAIL'), m(text, 'b@x.fr', 'EMAIL')]);
    return s;
  };

  it('liste les entrées dans l\'ordre de création', () => {
    expect(build().entries()).toEqual([
      { token: '[CLIENT_1]', category: 'CLIENT', value: 'Dupont SA' },
      { token: '[EMAIL_1]', category: 'EMAIL', value: 'a@x.fr' },
      { token: '[EMAIL_2]', category: 'EMAIL', value: 'b@x.fr' },
    ]);
  });

  it('efface tout', () => {
    const s = build();
    s.clear();
    expect(s.size).toBe(0);
    const text = 'c@x.fr';
    expect(s.clean(text, [m(text, 'c@x.fr', 'EMAIL')]).text).toBe('[EMAIL_1]');
  });

  it('fait l\'aller-retour toData / fromData et continue la numérotation', () => {
    const loaded = TokenSession.fromData(JSON.parse(JSON.stringify(build().toData())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.session.entries()).toEqual(build().entries());
    const text = 'c@x.fr puis a@x.fr';
    expect(loaded.session.clean(text, [m(text, 'c@x.fr', 'EMAIL'), m(text, 'a@x.fr', 'EMAIL')]).text).toBe('[EMAIL_3] puis [EMAIL_1]');
  });

  it.each([
    ['null', null],
    ['version inconnue', { version: 2, entries: [] }],
    ['entrées absentes', { version: 1 }],
    ['entrée non objet', { version: 1, entries: ['x'] }],
    ['jeton mal formé', { version: 1, entries: [{ token: 'CLIENT_1', category: 'CLIENT', value: 'a' }] }],
    ['catégorie incohérente', { version: 1, entries: [{ token: '[CLIENT_1]', category: 'EMAIL', value: 'a' }] }],
    ['valeur vide', { version: 1, entries: [{ token: '[CLIENT_1]', category: 'CLIENT', value: '' }] }],
    ['jeton en double', { version: 1, entries: [{ token: '[CLIENT_1]', category: 'CLIENT', value: 'a' }, { token: '[CLIENT_1]', category: 'CLIENT', value: 'b' }] }],
  ])('refuse des données invalides : %s', (_name, data) => {
    expect(TokenSession.fromData(data).ok).toBe(false);
  });
});

describe('TokenSession : performance', () => {
  it('nettoie 20 000 correspondances en moins de 500 ms', () => {
    const parts: string[] = [];
    const matches: Match[] = [];
    let pos = 0;
    for (let i = 0; i < 20_000; i++) {
      const value = `user${i % 5_000}@example.com`;
      const chunk = `ligne ${i} : `;
      parts.push(chunk, value, '\n');
      matches.push({ start: pos + chunk.length, end: pos + chunk.length + value.length, value, category: 'EMAIL' });
      pos += chunk.length + value.length + 1;
    }
    const text = parts.join('');
    const session = new TokenSession();
    const start = performance.now();
    const cleaned = session.clean(text, matches);
    const restored = session.restore(cleaned.text);
    expect(performance.now() - start).toBeLessThan(500);
    expect(restored.text).toBe(text);
    expect(session.size).toBe(5_000);
  });
});
