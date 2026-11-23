// The Dossier mark: a D made of a bar and a half disc (flat, one ink) on a 100-unit box, and its launch intro.
// Source and approved look: design/dossier-mark. Keep the intro numbers as they are.

/** The D with x as the centre of the whole letter (the bar's left edge is at x - 25). */
export function dPath(x = 50): string {
  const f = (n: number) => +n.toFixed(3);
  const seam = x - 12.5;
  return `M${f(seam - 12.5)} 12.5H${f(seam)}A37.5 37.5 0 0 1 ${f(seam)} 87.5H${f(seam - 12.5)}Z`;
}

/**
 * The intro: the top half glides in from the left and the bottom half from the right, at full speed from the
 * first frame and slowing exponentially, fading in over the first 60 % of the trip, then locking together.
 */
export const INTRO = {
  travel: 75, // how far each half starts from its place, in viewBox units
  tau: 0.12, // time constant, s: x(t) = travel * e^(-t / tau)
  fadeShare: 0.6, // fully opaque once this share of the trip is done
  land: 0.1, // snap home once closer than this (a quarter pixel at 250 px)
};

export interface IntroFrame {
  topX: number;
  bottomX: number;
  opacity: number;
  done: boolean;
}

/** Where the two halves are t seconds after the intro starts (t = 0 is the first frame shown). */
export function introAt(t: number): IntroFrame {
  // The first frame counts as one step in, so the first picture is already moving.
  const x = INTRO.travel * Math.exp(-(Math.max(0, t) + 1 / 60) / INTRO.tau);
  const done = x < INTRO.land;
  const d = done ? 0 : x;
  const opacity = done ? 1 : Math.max(0, Math.min(1, (1 - d / INTRO.travel) / INTRO.fadeShare));
  return { topX: -d, bottomX: d, opacity, done };
}
