import { web } from './web';

export interface Platform {
  start(): void;
  load<T>(key: string): Promise<T | undefined>;
  save(key: string, value: unknown): Promise<void>;
  copy(text: string): void;
  haptic(): void;
}

export const platform: Platform = web;
