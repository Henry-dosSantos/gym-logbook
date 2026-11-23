import { web } from './web';

export interface ExportFile { name: string; type: string; content: string }

export interface Platform {
  start(): void;
  load<T>(key: string): Promise<T | undefined>;
  save(key: string, value: unknown): Promise<void>;
  copy(text: string): void;
  share(files: ExportFile[]): Promise<void>;
  haptic(): void;
}

export const platform: Platform = web;
