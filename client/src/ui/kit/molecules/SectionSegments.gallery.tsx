import React from 'react';

import SectionSegments from './SectionSegments';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SectionSegments';

const SECTIONS = [{ label: 'Акты' }, { label: 'Персонажи' }, { label: 'Мир' }];

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · первый раздел активен',
    dark: true,
    node: <SectionSegments sections={SECTIONS} onPick={() => {}} />,
  },
  {
    title: 'активен другой раздел',
    dark: true,
    node: <SectionSegments sections={SECTIONS} active="Мир" onPick={() => {}} />,
  },
  {
    title: 'без onPick — разделы не кликабельны',
    dark: true,
    node: <SectionSegments sections={SECTIONS} active="Персонажи" />,
  },
];
