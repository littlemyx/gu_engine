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
  {
    title: 'direction=right · collapsed (▸)',
    node: <DisclosureArrow direction="right" expanded={false} onToggle={() => {}} />,
  },
  {
    title: 'direction=right · expanded (◂)',
    node: <DisclosureArrow direction="right" expanded onToggle={() => {}} />,
  },
  {
    title: 'direction=left · collapsed (◂)',
    node: <DisclosureArrow direction="left" expanded={false} onToggle={() => {}} />,
  },
  {
    title: 'direction=left · expanded (▸)',
    node: <DisclosureArrow direction="left" expanded onToggle={() => {}} />,
  },
  {
    title: 'direction=right · на тёмном (для PanelSpine)',
    dark: true,
    node: <DisclosureArrow direction="right" expanded={false} onDark onToggle={() => {}} />,
  },
];
