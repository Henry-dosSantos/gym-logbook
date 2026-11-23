import { describe, expect, it } from 'vitest';
import { appHeight } from '../../src/viewport';

const pro = { screenWidth: 402, screenHeight: 874 };

describe('appHeight', () => {
  it('fills the whole screen in a Home Screen app even when iOS reports less', () => {
    expect(appHeight({ ...pro, visual: 840, inner: 840, innerWidth: 402, standalone: true, keyboard: false })).toBe(874);
  });

  it('fills the screen in landscape too', () => {
    expect(appHeight({ ...pro, visual: 380, inner: 380, innerWidth: 874, standalone: true, keyboard: false })).toBe(402);
  });

  it('uses the area above the keyboard while it is up', () => {
    expect(appHeight({ ...pro, visual: 500, inner: 874, innerWidth: 402, standalone: true, keyboard: true })).toBe(500);
  });

  it('leaves Safari tabs and Split View to the window', () => {
    expect(appHeight({ ...pro, visual: 700, inner: 720, innerWidth: 402, standalone: false, keyboard: false })).toBe(720);
    const duo = { screenWidth: 669, screenHeight: 951 };
    expect(appHeight({ ...duo, visual: 900, inner: 900, innerWidth: 330, standalone: true, keyboard: false })).toBe(900);
    expect(appHeight({ ...duo, visual: 930, inner: 930, innerWidth: 669, standalone: true, keyboard: false })).toBe(951);
  });
});
