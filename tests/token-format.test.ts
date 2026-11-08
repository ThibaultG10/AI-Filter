import { describe, expect, it } from 'vitest';
import { scanTokenNames, tokenName, tokenOf } from '../src/core/token-format';

describe('tokenName / tokenOf', () => {
  it('met en forme canonique', () => {
    expect(tokenName('client', 1)).toBe('CLIENT_1');
    expect(tokenName('Equipe\\_interne', '03')).toBe('EQUIPE_INTERNE_3');
    expect(tokenOf('CLIENT_1')).toBe('[CLIENT_1]');
  });
});

describe('scanTokenNames', () => {
  it.each([
    ['[CLIENT_1]', ['CLIENT_1']],
    ['[client_1]', ['CLIENT_1']],
    ['[ CLIENT_1 ]', ['CLIENT_1']],
    ['\\[CLIENT\\_1\\]', ['CLIENT_1']],
    ['[CLIENT\\_1]', ['CLIENT_1']],
    ['[EQUIPE_INTERNE_12]', ['EQUIPE_INTERNE_12']],
    ['CLIENT_1', ['CLIENT_1']],
    ['(EMAIL_2)', ['EMAIL_2']],
    ['[CLIENT_1] et [EMAIL_2]', ['CLIENT_1', 'EMAIL_2']],
  ])('trouve %s', (text, expected) => {
    expect([...scanTokenNames(text)].sort()).toEqual([...expected].sort());
  });

  it.each(['client_1', 'mon_client_1', 'CLIENT_', '[CLIENT]', '[1]', '[CLIENT_x]', '_CLIENT_1', 'XCLIENT_1_', 'texte normal'])(
    'ne trouve rien dans « %s »',
    (text) => {
      // « mon_client_1 » et « client_1 » (minuscules) sont des identifiants, pas des jetons nus.
      expect([...scanTokenNames(text)]).toEqual([]);
    },
  );
});

describe('scanTokenNames : robustesse (pas de ReDoS)', () => {
  it('traite 50 000 caractères adverses en moins de 300 ms', () => {
    const inputs = [
      '['.repeat(50_000),
      '[A_'.repeat(16_000),
      '[' + 'A'.repeat(50_000),
      'A_'.repeat(25_000),
      'A'.repeat(50_000) + '_1',
      '\\_'.repeat(25_000),
      '[ ' + ' '.repeat(50_000) + 'A_1',
      '[A_1' + '9'.repeat(50_000),
    ];
    for (const input of inputs) {
      const start = performance.now();
      scanTokenNames(input);
      expect(performance.now() - start, input.slice(0, 20)).toBeLessThan(300);
    }
  });
});
