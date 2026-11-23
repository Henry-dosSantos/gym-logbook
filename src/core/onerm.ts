export function estimate1RM(weight: number, reps: number): number | null {
  if (weight <= 0 || reps < 1) return null;
  if (reps === 1) return weight;
  return (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps));
}
