import type { Settings } from './core/types';
import type { ExportFile } from './platform';

const pad = (n: number) => String(n).padStart(2, '0');

export function exportFiles(text: string, settings: Settings, date: Date): ExportFile[] {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return [
    { name: `logbook-${day}.txt`, type: 'text/plain', content: text },
    { name: 'logbook-settings.json', type: 'application/json', content: JSON.stringify(settings, null, 2) },
  ];
}
