import { describe, expect, it } from 'vitest';
import { DETECTORS } from '../src/core/detectors';
import { BANNER_TEXT } from '../src/config/texts';

describe('socle', () => {
  it('expose la liste des détecteurs par défaut', () => {
    expect(DETECTORS.length).toBeGreaterThan(0);
  });

  it('affiche la promesse honnête dans le bandeau', () => {
    expect(BANNER_TEXT).toContain('100 % local');
    expect(BANNER_TEXT).toContain('pas de garantie absolue');
  });
});
