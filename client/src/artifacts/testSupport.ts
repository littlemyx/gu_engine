import { emptyMeta } from './transitions';

import type { ArtifactKey, ArtifactMeta } from './types';

/** Сборка ключей в тестах: `artifactKey('spine')` → `'spine/'`. */
export function artifactKey(stage: string, item = ''): ArtifactKey {
  return `${stage}/${item}` as ArtifactKey;
}

export function emptyIndexEntry(key: string): ArtifactMeta {
  return emptyMeta(key as ArtifactKey);
}
