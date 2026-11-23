import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  aliases: [
    ['Incline DB', 'Incline DB press', 'Incline dumbbell press'],
    ['Tricep pushdowns', 'Tricep pauhdowns'],
    ['Db lat raises', 'Db lat raise'],
    ['Cable lat raises', 'Cable lat raise'],
    ['Leg curls', 'Leg curl'],
    ['Leg extensions', 'Leg extension'],
    ['Weighted sit ups', 'Weighed sit ups'],
    ['Horizontal rows', 'Horitonstal rows'],
    ['Bench', 'Flat bench'],
  ],
  exercises: {},
};

type Field = 'target' | 'increment';

export const BUILTIN = { target: 4, increment: 5 };

export function globalRule(s: Settings): { target: number; increment: number } {
  return { target: s.defaults?.target ?? BUILTIN.target, increment: s.defaults?.increment ?? BUILTIN.increment };
}

export function exerciseRule(s: Settings, key: string): { target: number; increment: number; custom: boolean } {
  const own = s.exercises[key];
  const base = globalRule(s);
  return {
    target: own?.target ?? base.target,
    increment: own?.increment ?? base.increment,
    custom: own !== undefined && (own.target !== undefined || own.increment !== undefined),
  };
}

export function setGlobal(s: Settings, field: Field, value: number): Settings {
  const defaults = { ...s.defaults };
  if (value === BUILTIN[field]) delete defaults[field];
  else defaults[field] = value;
  const { defaults: _old, ...rest } = s;
  return Object.keys(defaults).length ? { ...rest, defaults } : rest;
}

export function setExerciseRule(s: Settings, key: string, field: Field, value: number): Settings {
  const entry = { ...s.exercises[key] };
  if (value === globalRule(s)[field]) delete entry[field];
  else entry[field] = value;
  const exercises = { ...s.exercises };
  if (Object.keys(entry).length) exercises[key] = entry;
  else delete exercises[key];
  return { ...s, exercises };
}

export function clearExerciseRule(s: Settings, key: string): Settings {
  const exercises = { ...s.exercises };
  delete exercises[key];
  return { ...s, exercises };
}

export function setAliasGroups(s: Settings, groups: string[][]): Settings {
  const aliases = groups
    .map(g => g.map(n => n.trim()).filter(Boolean))
    .filter(g => g.length >= 2);
  return { ...s, aliases };
}
