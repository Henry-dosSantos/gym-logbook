import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  clearExerciseRule,
  exerciseRule,
  globalRule,
  setAliasGroups,
  setExerciseRule,
  setGlobal,
} from '../../src/core/settings';
import { effectiveTopInset } from '../../src/viewport';

const frozen = () => structuredClone(DEFAULT_SETTINGS);

describe('settings helpers', () => {
  it('sets and clears the global rule', () => {
    const s = setGlobal(frozen(), 'target', 6);
    expect(s.defaults).toEqual({ target: 6 });
    expect(globalRule(s)).toEqual({ target: 6, increment: 5 });
    expect(setGlobal(s, 'target', 4).defaults).toBeUndefined();
  });

  it('sets per-exercise rules against the global rule', () => {
    const s2 = setExerciseRule(frozen(), 'bench', 'increment', 10);
    expect(exerciseRule(s2, 'bench')).toEqual({ target: 4, increment: 10, custom: true });
    expect(exerciseRule(s2, 'rows')).toEqual({ target: 4, increment: 5, custom: false });
    expect('bench' in setExerciseRule(s2, 'bench', 'increment', 5).exercises).toBe(false);
    expect('bench' in clearExerciseRule(s2, 'bench').exercises).toBe(false);
  });

  it('cleans alias groups', () => {
    const s = setAliasGroups(frozen(), [[' A ', 'B', ''], ['solo'], ['', ' ']]);
    expect(s.aliases).toEqual([['A', 'B']]);
  });

  it('never mutates its input', () => {
    const s = setExerciseRule(setGlobal(frozen(), 'target', 6), 'bench', 'target', 8);
    const copy = structuredClone(s);
    setGlobal(s, 'increment', 10);
    setExerciseRule(s, 'bench', 'increment', 10);
    setExerciseRule(s, 'rows', 'target', 3);
    clearExerciseRule(s, 'bench');
    setAliasGroups(s, [['a', 'b']]);
    expect(s).toEqual(copy);
  });
});

describe('effectiveTopInset', () => {
  it.each([
    [59, 852, 852, 59],
    [59, 852, 793, 0],
    [62, 956, 894, 0],
    [0, 852, 700, 0],
    [20, 852, 393, 0],
    [47, 844, 844, 47],
  ])('(%i, %i, %i) -> %i', (env, screen, inner, expected) => {
    expect(effectiveTopInset(env, screen, inner)).toBe(expected);
  });
});
