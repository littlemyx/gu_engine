import React from 'react';

import Swatch from './Swatch';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Swatch';

export const cases: GalleryCase[] = [
  { title: 'palette', node: <Swatch color="#5980a6" /> },
  { title: 'palette · кликабельная', node: <Swatch color="#9dc1e0" onClick={() => {}} /> },
  { title: 'palette · без hex', node: <Swatch color="#1d1f20" showHex={false} /> },
  { title: 'legend', node: <Swatch variant="legend" color="#e3b341" label="трава" /> },
  { title: 'add', node: <Swatch variant="add" onClick={() => {}} /> },
];
