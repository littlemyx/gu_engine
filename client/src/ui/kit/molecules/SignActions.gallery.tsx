import React from 'react';

import SignActions from './SignActions';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SignActions';

export const cases: GalleryCase[] = [
  { title: 'по умолчанию', node: <SignActions onCancel={() => {}} onConfirm={() => {}} /> },
  {
    title: 'со сметой',
    node: <SignActions price="≈$3.46" onCancel={() => {}} onConfirm={() => {}} />,
  },
  {
    title: 'свои тексты',
    node: (
      <SignActions
        cancelLabel="Не сейчас"
        confirmLabel="Подписать акт"
        price="≈$1.10"
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    ),
  },
  { title: 'disabled', node: <SignActions disabled onCancel={() => {}} onConfirm={() => {}} /> },
  { title: 'loading', node: <SignActions loading onCancel={() => {}} onConfirm={() => {}} /> },
];
