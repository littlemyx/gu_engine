import React from 'react';

import ToneSurface from './ToneSurface';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ToneSurface';

const demo = <span style={{ fontSize: 11 }}>контент подложки</span>;

export const cases: GalleryCase[] = [
  { title: 'accent', node: <ToneSurface tone="accent">{demo}</ToneSurface> },
  { title: 'white on dark', dark: true, node: <ToneSurface tone="whiteOnDark">{demo}</ToneSurface> },
  { title: 'error', node: <ToneSurface tone="error">{demo}</ToneSurface> },
  { title: 'warn', node: <ToneSurface tone="warn">{demo}</ToneSurface> },
  { title: 'dark accent-900', dark: true, node: <ToneSurface tone="darkAccent">{demo}</ToneSurface> },
];
