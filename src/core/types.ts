export type LineKind = 'header' | 'blank' | 'date' | 'day' | 'exercise' | 'superset' | 'note';
export type LintCode = 'date-backwards' | 'wrong-year' | 'no-name' | 'day-as-name' | 'bad-number' | 'missing-dash' | 'bad-set';
export interface SetEntry {
  weight: number | 'max' | null; // null: no numeric weight (reps-only, "light", malformed)
  pair: boolean;                 // weight written with s suffix (60s = dumbbell pair)
  reps: number | null;           // null: empty or non-numeric
  seconds: number | null;        // reps slot was a duration (60s, "10 seconds")
}
export interface Shorthand { sets: number | null; repsMin: number | null; repsMax: number | null }
export interface Line {
  n: number;        // 1-based line number
  from: number;     // offset of line start in the text
  to: number;       // offset of line end (before the "\n")
  text: string;     // raw line
  kind: LineKind;
  month?: number; day?: number; year?: number;   // date lines; year as written (25), undefined if absent
  rest?: string;                                 // date lines: trimmed text after the date ('' if none)
  name?: string;        // exercise lines: display name ('' when nameless and nothing to inherit)
  inherited?: boolean;  // exercise lines: name came from the previous line (continuation)
  sets?: SetEntry[];    // exercise lines ([] when shorthand)
  shorthand?: Shorthand | null;
  setsText?: string;    // exercise lines: cleaned sets part for display
  flags: LintCode[];    // [] when clean
}
export interface Entry {
  index: number;            // position in Doc.entries
  dateLine: Line;
  month: number; day: number;
  dayLine: Line | null;     // the line holding the day type (the date line itself for "8/12 push at 11 pm")
  dayRaw: string | null;    // day type as typed with the note stripped, trimmed, e.g. "Heavy push"
  dayKey: string | null;    // normalized day type, e.g. "heavy push"
  lines: Line[];            // every line of the entry, date line first, up to the line before the next date line
}
export interface LintFlag { line: number; code: LintCode; message: string }
export interface Doc { text: string; lines: Line[]; entries: Entry[]; year: number | null; flags: LintFlag[] }
export interface ExerciseSetting { target?: number; increment?: number }
export interface Settings { aliases: string[][]; exercises: Record<string, ExerciseSetting>; defaults?: ExerciseSetting } // exercises keyed by exercise key
export interface Ghost { text: string; kind: 'date' | 'day' | 'name' | 'weight' | 'dash' | 'slash'; space: boolean } // space: Space key accepts it
export interface StripItem { date: string; sets: string }
export interface Suggestion { ghost: Ghost | null; strip: StripItem[] }
