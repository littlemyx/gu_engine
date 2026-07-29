import React from 'react';

import ReleasePassport from './ReleasePassport';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ReleasePassport';

const RELEASE_LINES = [
  'n: 2 · 14 июля, 18:02',
  'bundle: StoryBundleV2 · 412 КБ',
  'qaReport: #5 · 0 блокеров',
  'seed: 12345',
];

const SHORT_LINES = ['n: 1 · 3 марта, 09:11', 'seed: 88214'];

export const cases: GalleryCase[] = [
  { title: 'паспорт релиза', dark: true, node: <ReleasePassport lines={RELEASE_LINES} /> },
  { title: 'короткий паспорт', dark: true, node: <ReleasePassport lines={SHORT_LINES} /> },
  { title: 'пустой паспорт', dark: true, node: <ReleasePassport lines={[]} /> },
];
