import React from 'react';

import FieldGroup from './FieldGroup';

import type { GalleryCase } from '../galleryTypes';

export const title = 'FieldGroup';

export const cases: GalleryCase[] = [
  {
    title: 'обычная',
    node: (
      <FieldGroup title="Жанр и формат" meta="genre · format · endingsProfile" state="ok">
        <p>поля секции…</p>
      </FieldGroup>
    ),
  },
  {
    title: 'ошибка',
    node: (
      <FieldGroup title="Персонажи" meta="genre · format · endingsProfile" errorMeta="✗ 0 персонажей" state="error">
        <p>добавьте хотя бы одного персонажа</p>
      </FieldGroup>
    ),
  },
  {
    title: 'без содержимого',
    node: <FieldGroup title="Мир" meta="setting · timeframe" state="ok" />,
  },
];
