import React from 'react';

import SearchField from './SearchField';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SearchField';

export const cases: GalleryCase[] = [
  { title: 'обычный', dark: true, node: <SearchField placeholder="поиск по истории…" /> },
  { title: 'с введённым значением', dark: true, node: <SearchField value="детектив" /> },
  { title: 'disabled', dark: true, node: <SearchField state="disabled" /> },
  { title: 'error', dark: true, node: <SearchField state="error" value="???" /> },
];
