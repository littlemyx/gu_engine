import React from 'react';

import HighlightLine from './HighlightLine';

import type { GalleryCase } from '../galleryTypes';

export const title = 'HighlightLine';

export const cases: GalleryCase[] = [
  {
    title: 'цитата',
    node: <HighlightLine kind="quote" before="КИРА: «" highlight="Вы ведь обещали" after=" вернуться до шторма…»" />,
  },
  {
    title: 'цитата · со строкой-источником',
    node: (
      <HighlightLine
        kind="quote"
        before="КИРА: «"
        highlight="Вы ведь обещали"
        after=" вернуться до шторма…»"
        post="сцена 4 · черновик"
      />
    ),
  },
  {
    title: 'цитата · фиксированная ширина',
    node: <HighlightLine kind="quote" before="КИРА: «" highlight="Вы ведь обещали" after=" вернуться…»" width={280} />,
  },
  {
    title: 'редактор',
    dark: true,
    node: <HighlightLine kind="editor" before="КИРА: «" highlight="Вы ведь обещали" after=" вернуться до шторма…»" />,
  },
  {
    title: 'редактор · с ремаркой и курсором',
    dark: true,
    node: (
      <HighlightLine
        kind="editor"
        pre="дубль 2 · интонация мягче"
        before="КИРА: «"
        highlight="Вы ведь обещали"
        after=" вернуться до"
        cursor
      />
    ),
  },
  {
    title: 'редактор · со строкой-источником',
    dark: true,
    node: (
      <HighlightLine
        kind="editor"
        before="КИРА: «"
        highlight="Вы ведь обещали"
        after=" вернуться до шторма…»"
        post="прогон #14 · сид 8821"
      />
    ),
  },
];
