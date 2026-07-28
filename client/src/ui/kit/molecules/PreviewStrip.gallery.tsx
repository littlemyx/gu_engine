import React from 'react';

import PreviewStrip from './PreviewStrip';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PreviewStrip';

export const cases: GalleryCase[] = [
  {
    title: 'спрайты · без остатка',
    node: <PreviewStrip kind="sprite" tiles={[{ label: 'idle' }, { label: 'joy' }, { label: 'sad' }]} />,
  },
  {
    title: 'спрайты · с плиткой «+N»',
    node: <PreviewStrip kind="sprite" tiles={[{ label: 'idle' }, { label: 'joy' }]} more={3} />,
  },
  {
    title: 'спрайты · выбранный кадр',
    node: (
      <PreviewStrip kind="sprite" tiles={[{ label: 'idle', selected: true }, { label: 'joy' }, { label: 'sad' }]} />
    ),
  },
  {
    title: 'спрайты · кликабельные превью',
    node: <PreviewStrip kind="sprite" tiles={[{ label: 'idle' }, { label: 'joy' }]} onTileClick={() => {}} />,
  },
  {
    title: 'локации · без остатка',
    node: <PreviewStrip kind="location" tiles={[{ label: 'пирс' }, { label: 'кафе' }]} />,
  },
  {
    title: 'локации · с плиткой «+N ○»',
    node: <PreviewStrip kind="location" tiles={[{ label: 'пирс' }, { label: 'кафе' }]} more={2} />,
  },
  {
    title: 'спрайты · на тёмном',
    dark: true,
    node: <PreviewStrip kind="sprite" tiles={[{ label: 'idle', selected: true }, { label: 'joy' }]} more={1} onDark />,
  },
  {
    title: 'локации · на тёмном',
    dark: true,
    node: <PreviewStrip kind="location" tiles={[{ label: 'пирс' }]} more={2} onDark />,
  },
];
