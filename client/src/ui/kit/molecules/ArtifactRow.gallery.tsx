import React from 'react';

import ArtifactRow from './ArtifactRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ArtifactRow';

export const cases: GalleryCase[] = [
  { title: 'authored · авторская правка', dark: true, node: <ArtifactRow artifactName="каст-план" mark="authored" /> },
  { title: 'fresh · готово', dark: true, node: <ArtifactRow artifactName="каст-план" mark="fresh" /> },
  { title: 'stale · устарело', dark: true, node: <ArtifactRow artifactName="спайн" mark="stale" /> },
  { title: 'none · не создано', dark: true, node: <ArtifactRow artifactName="мировой календарь" mark="none" /> },
];
