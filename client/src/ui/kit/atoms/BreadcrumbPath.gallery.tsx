import React from 'react';

import BreadcrumbPath from './BreadcrumbPath';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BreadcrumbPath';

const PATH = 'Акт II › слот Д5в › Б5 «Ссора»';

export const cases: GalleryCase[] = [
  {
    title: 'жирный текущий · на светлом',
    node: <BreadcrumbPath path={PATH} />,
  },
  {
    title: 'без жирного · на светлом',
    node: <BreadcrumbPath path={PATH} bold={false} />,
  },
  {
    title: 'крупный размер · на светлом',
    node: <BreadcrumbPath path={PATH} size={13} />,
  },
  {
    title: 'один сегмент · на светлом',
    node: <BreadcrumbPath path="Акт II" />,
  },
  {
    title: 'жирный текущий · на тёмном',
    dark: true,
    node: <BreadcrumbPath path={PATH} onDark />,
  },
  {
    title: 'без жирного · на тёмном',
    dark: true,
    node: <BreadcrumbPath path={PATH} bold={false} onDark />,
  },
];
