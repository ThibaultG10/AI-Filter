import { describe, expect, it } from 'vitest';
import { restoreTokens } from '../src/core/restore';

const TABLE = new Map<string, string>([
  ['CLIENT_1', 'Dupont SA'],
  ['EMAIL_1', 'jean@example.com'],
  ['EMAIL_2', 'paul@example.com'],
  ['EQUIPE_INTERNE_1', 'Équipe Rocket'],
]);

const restore = (text: string, table: ReadonlyMap<string, string> = TABLE) => restoreTokens(text, table);

describe('restoreTokens : formes acceptées', () => {
  it.each([
    ['Bonjour [CLIENT_1] !', 'Bonjour Dupont SA !'],
    ['Bonjour [client_1] !', 'Bonjour Dupont SA !'],
    ['Bonjour [ CLIENT_1 ] !', 'Bonjour Dupont SA !'],
    ['Bonjour [CLIENT\\_1] !', 'Bonjour Dupont SA !'],
    ['Bonjour \\[CLIENT\\_1\\] !', 'Bonjour Dupont SA !'],
    ['Bonjour **[CLIENT_1]** !', 'Bonjour **Dupont SA** !'],
    ['Bonjour [CLIENT_1]\'s team', 'Bonjour Dupont SA\'s team'],
    ['Bonjour [CLIENT_01]', 'Bonjour Dupont SA'],
    ['[EQUIPE_INTERNE_1] et [EQUIPE\\_INTERNE\\_1]', 'Équipe Rocket et Équipe Rocket'],
    ['[EMAIL_1],[EMAIL_2]', 'jean@example.com,paul@example.com'],
    ['Bonjour CLIENT_1 !', 'Bonjour Dupont SA !'],
    ['(EMAIL_1)', '(jean@example.com)'],
  ])('« %s »', (input, expected) => {
    expect(restore(input).text).toBe(expected);
  });

  it('compte les jetons restaurés', () => {
    expect(restore('[CLIENT_1] [CLIENT_1] [EMAIL_2]').restored).toBe(3);
  });
});

describe('restoreTokens : ce qui ne doit pas être remplacé', () => {
  it.each([
    'client_1 est une variable',
    'mon_CLIENT_1_id',
    'XCLIENT_1',
    'CLIENT_12',
    '[CLIENT]',
    '[CLIENT_x]',
    'EMAIL_3',
  ])('laisse « %s » tel quel', (input) => {
    expect(restore(input).text).toBe(input);
  });

  it('ne relit jamais une valeur insérée comme un jeton', () => {
    const table = new Map([
      ['CLIENT_1', '[EMAIL_1]'],
      ['EMAIL_1', 'jean@example.com'],
    ]);
    expect(restoreTokens('[CLIENT_1] puis [EMAIL_1]', table).text).toBe('[EMAIL_1] puis jean@example.com');
  });

  it('insère les valeurs telles quelles (pas d\'interprétation de $&, $1…)', () => {
    const table = new Map([['CLIENT_1', "Coût $& $1 $$ \\ ' `"]]);
    expect(restoreTokens('a [CLIENT_1] b', table).text).toBe("a Coût $& $1 $$ \\ ' ` b");
  });
});

describe('restoreTokens : rapport', () => {
  it('signale les jetons inventés (laissés tels quels)', () => {
    const r = restore('Pour [CLIENT_7] et [client_7] et [EMAIL_9], mais [CLIENT_1] ok');
    expect(r.text).toBe('Pour [CLIENT_7] et [client_7] et [EMAIL_9], mais Dupont SA ok');
    expect(r.unknown).toEqual(['CLIENT_7', 'EMAIL_9']);
  });

  it('signale les jetons connus absents de la réponse', () => {
    const r = restore('Seulement [CLIENT_1] ici');
    expect(r.missing).toEqual(['EMAIL_1', 'EMAIL_2', 'EQUIPE_INTERNE_1']);
    expect(r.unknown).toEqual([]);
  });

  it('ne signale pas comme inventés les crochets ordinaires', () => {
    const r = restore('Voir [1], [sic], [A_B], [tableau[0]]');
    expect(r.unknown).toEqual([]);
  });

  it('fonctionne avec une table vide et signale quand même les jetons inconnus', () => {
    const r = restoreTokens('Bonjour [CLIENT_1]', new Map());
    expect(r).toEqual({ text: 'Bonjour [CLIENT_1]', restored: 0, missing: [], unknown: ['CLIENT_1'] });
  });
});

describe('restoreTokens : robustesse', () => {
  it('traite 50 000 caractères adverses en moins de 300 ms', () => {
    const inputs = [
      '['.repeat(50_000),
      '[A_1' + ' '.repeat(50_000),
      '[CLIENT_'.repeat(6_000),
      'CLIENT_'.repeat(7_000),
      '\\['.repeat(25_000),
      '[A_1][A_1]'.repeat(5_000),
    ];
    for (const input of inputs) {
      const start = performance.now();
      restore(input);
      expect(performance.now() - start).toBeLessThan(300);
    }
  });

  it('restaure 5 000 jetons sur un grand texte en moins de 300 ms', () => {
    const table = new Map<string, string>();
    for (let i = 1; i <= 5_000; i++) table.set(`EMAIL_${i}`, `user${i}@example.com`);
    const text = Array.from({ length: 5_000 }, (_, i) => `ligne [EMAIL_${i + 1}] fin`).join('\n');
    const start = performance.now();
    const r = restoreTokens(text, table);
    expect(performance.now() - start).toBeLessThan(300);
    expect(r.restored).toBe(5_000);
    expect(r.missing).toEqual([]);
  });
});
