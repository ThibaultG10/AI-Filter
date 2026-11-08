import { describe, expect, it } from 'vitest';
import { DETECTORS } from '../src/core/detectors';
import { FR } from '../src/config/texts';

describe('socle', () => {
  it('expose la liste des détecteurs par défaut', () => {
    expect(DETECTORS.length).toBeGreaterThan(0);
  });

  it('affiche la promesse honnête dans le bandeau', () => {
    expect(FR.banner).toContain('100 % local');
    expect(FR.banner).toContain('pas de garantie absolue');
  });
});
