import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { platform } from '../../src/platform';

const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);

describe('storage round trip', () => {
  it('keeps awkward text byte for byte', async () => {
    const text = 'Bench\t290-3/ \n  trailing  \nsmile \u{1F600} \u201Cquoted\u201D it\u2019s\nno newline';
    expect(EditorState.create({ doc: text }).doc.toString()).toBe(text);
    await platform.save('text', text);
    const loaded = await platform.load<string>('text');
    expect(loaded).toBe(text);
    expect(Buffer.from(loaded!, 'utf8').equals(Buffer.from(text, 'utf8'))).toBe(true);
  });

  it('returns undefined for a missing key', async () => {
    expect(await platform.load('missing')).toBeUndefined();
  });

  describe.skipIf(!existsSync(fixturePath))('fixture', () => {
    it('survives the editor and storage', async () => {
      const F = readFileSync(fixturePath, 'utf8');
      expect(EditorState.create({ doc: F }).doc.toString()).toBe(F);
      await platform.save('text', F);
      const loaded = await platform.load<string>('text');
      expect(loaded).toBe(F);
      expect(Buffer.from(loaded!, 'utf8').equals(readFileSync(fixturePath))).toBe(true);
    });
  });
});
