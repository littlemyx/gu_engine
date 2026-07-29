import React from 'react';

import GalleryActions from './GalleryActions';

import type { GalleryCase } from '../galleryTypes';

export const title = 'GalleryActions';

export const cases: GalleryCase[] = [
  { title: 'по умолчанию', node: <GalleryActions onAccept={() => {}} onDub={() => {}} /> },
  {
    title: 'свои тексты и смета',
    node: (
      <GalleryActions
        acceptLabel="Принять кадр"
        dubLabel="Ещё один дубль"
        dubPrice="≈$0.12"
        onAccept={() => {}}
        onDub={() => {}}
      />
    ),
  },
  {
    title: 'без сметы дубля',
    node: <GalleryActions dubPrice="" onAccept={() => {}} onDub={() => {}} />,
  },
  { title: 'disabled', node: <GalleryActions disabled onAccept={() => {}} onDub={() => {}} /> },
];
