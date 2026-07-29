import React from 'react';

import PromptTemplate from './PromptTemplate';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PromptTemplate';

const DEFAULT_TEXT = 'soft anime painterly, pastel palette, autumnal lighting, {scene_focus}';
const DEFAULT_NOTE = '{scene_focus} конвейер подставит сам — по локации и фазе слота';

export const cases: GalleryCase[] = [
  { title: 'с подсказкой', node: <PromptTemplate text={DEFAULT_TEXT} note={DEFAULT_NOTE} /> },
  { title: 'без подсказки', node: <PromptTemplate text={DEFAULT_TEXT} /> },
  {
    title: 'несколько токенов',
    node: <PromptTemplate text="{character}, {location}, {mood} lighting, cinematic" />,
  },
  { title: 'узкий блок', node: <PromptTemplate text={DEFAULT_TEXT} note={DEFAULT_NOTE} width={240} /> },
  {
    title: 'с подсказкой · на тёмном',
    dark: true,
    node: <PromptTemplate text={DEFAULT_TEXT} note={DEFAULT_NOTE} onDark />,
  },
  {
    title: 'без подсказки · на тёмном',
    dark: true,
    node: <PromptTemplate text={DEFAULT_TEXT} onDark />,
  },
];
