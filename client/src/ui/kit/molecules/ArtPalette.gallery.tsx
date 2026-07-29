import React from 'react';

import ArtPalette from './ArtPalette';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ArtPalette';

const COLORS = ['d8c8b6', 'a4b8a2', '5a6b7c', '1f2a30'];

export const cases: GalleryCase[] = [
  {
    title: 'с hex-подписями + add',
    node: <ArtPalette colors={COLORS} onPick={() => {}} onAdd={() => {}} />,
  },
  {
    title: 'без hex-подписей',
    node: <ArtPalette colors={COLORS} showHex={false} onPick={() => {}} onAdd={() => {}} />,
  },
  {
    title: 'без кнопки добавления',
    node: <ArtPalette colors={COLORS} withAdd={false} onPick={() => {}} />,
  },
  {
    title: 'без колбэков · не кликабельно',
    node: <ArtPalette colors={COLORS} />,
  },
  {
    title: 'два цвета',
    node: <ArtPalette colors={['5980a6', 'e3b341']} onPick={() => {}} onAdd={() => {}} />,
  },
];
