import React from 'react';

import DisclosureArrow from './DisclosureArrow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DisclosureArrow';

export const cases: GalleryCase[] = [
  { title: 'collapsed', node: <DisclosureArrow expanded={false} onToggle={() => {}} /> },
  { title: 'expanded', node: <DisclosureArrow expanded onToggle={() => {}} /> },
  { title: 'без колбэка (немая)', node: <DisclosureArrow expanded={false} /> },
  { title: 'размер 14px', node: <DisclosureArrow expanded size={14} onToggle={() => {}} /> },
  {
    title: 'collapsed · на тёмном',
    dark: true,
    node: <DisclosureArrow expanded={false} onDark onToggle={() => {}} />,
  },
  {
    title: 'expanded · на тёмном',
    dark: true,
    node: <DisclosureArrow expanded onDark onToggle={() => {}} />,
  },
];
