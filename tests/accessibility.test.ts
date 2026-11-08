import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Contraste WCAG 2.1 calculé directement sur les variables de src/ui/style.css.

const css = readFileSync('src/ui/style.css', 'utf8');

function parseVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1]!] = m[2]!;
  return vars;
}

const lightBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const darkBlock = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const light = parseVars(lightBlock);
const dark = { ...light, ...parseVars(darkBlock) };

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [premier plan, arrière-plan, minimum] : 4.5 pour le texte, 3 pour les bordures de contrôles.
const PAIRS: Array<[string, string, number]> = [
  ['--tx', '--bg', 4.5],
  ['--tx', '--card', 4.5],
  ['--mut', '--card', 4.5],
  ['--mut', '--bg', 4.5],
  ['--ac-tx', '--ac', 4.5],
  ['--hl-tx', '--hl', 4.5],
  ['--err', '--card', 4.5],
  ['--err', '--bg', 4.5],
  ['--danger', '--card', 4.5],
  ['--ac', '--card', 3],
  ['--ctl', '--card', 3],
  ['--ctl', '--bg', 3],
  ['--hl-tx', '--hl', 4.5],
];

describe('accessibilité : contraste AA', () => {
  it('lit les deux thèmes', () => {
    expect(Object.keys(light).length).toBeGreaterThanOrEqual(12);
    expect(darkBlock).not.toBe('');
  });

  for (const [name, theme] of [['clair', light], ['sombre', dark]] as const) {
    for (const [fg, bg, min] of PAIRS) {
      it(`thème ${name} : ${fg} sur ${bg} ≥ ${min}`, () => {
        expect(theme[fg], fg).toBeDefined();
        expect(theme[bg], bg).toBeDefined();
        expect(ratio(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(min);
      });
    }
  }

  it('aucune couleur codée en dur hors des variables', () => {
    const rest = css.replace(/:root\s*\{[^}]*\}/g, '').replace(/@media \(prefers-color-scheme: dark\)\s*\{\s*\}/g, '');
    expect(rest.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it('garde un indicateur de focus visible et une cible tactile de 44 px', () => {
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/button\s*\{[^}]*min-height:\s*44px/);
  });
});
