// =============================================================================
// JSON snapshot persistence — Windows-safe, no native addons
// Dual-write from the stack. Not a replacement for engine internals.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';

export interface SnapshotEnvelope<T> {
  readonly version: 1;
  readonly savedAt: string;
  readonly data: T;
}

export class JsonSnapshotStore<T> {
  constructor(private readonly filePath: string) {}

  load(): T | undefined {
    if (!existsSync(this.filePath)) return undefined;
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as SnapshotEnvelope<T>;
      if (!parsed || parsed.version !== 1 || parsed.data === undefined) return undefined;
      return parsed.data;
    } catch {
      return undefined;
    }
  }

  save(data: T): void {
    const dir = dirname(this.filePath);
    if (dir && dir !== '.' && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const envelope: SnapshotEnvelope<T> = {
      version: 1,
      savedAt: new Date().toISOString(),
      data,
    };
    writeFileSync(this.filePath, JSON.stringify(envelope, null, 2), 'utf8');
  }
}
