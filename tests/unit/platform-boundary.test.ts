import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = fileURLToPath(new URL('../../src/', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(src).filter(f => f.endsWith('.ts'));
const inside = (f: string, dir: string) => f.replace(/\\/g, '/').includes(`/src/${dir}/`);

describe('platform boundary', () => {
  it('keeps browser storage, clipboard and share APIs inside src/platform', () => {
    const pattern = /\bnavigator\.|\bindexedDB\b|execCommand|createObjectURL|\blocalStorage\b|\bsessionStorage\b/;
    const offenders = files.filter(f => !inside(f, 'platform') && pattern.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('does not let core or editor import the platform', () => {
    const offenders = files
      .filter(f => inside(f, 'core') || inside(f, 'editor'))
      .filter(f => /(?:import|from)\s[^;]*['"][^'"]*platform[^'"]*['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('has no src/storage.ts', () => {
    expect(existsSync(join(src, 'storage.ts'))).toBe(false);
  });
});
