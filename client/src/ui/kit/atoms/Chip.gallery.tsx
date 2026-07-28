import React from 'react';

import Chip from './Chip';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Chip';

export const cases: GalleryCase[] = [
  { title: 'tinted', node: <Chip label="детектив" /> },
  { title: 'outline', node: <Chip label="детектив" kind="outline" /> },
  { title: 'removable', node: <Chip label="детектив" kind="removable" /> },
  { title: 'add', node: <Chip label="жанр" kind="add" /> },
  { title: 'error', node: <Chip label="нет каста" kind="error" /> },
  { title: 'warn', node: <Chip label="устарело" kind="warn" /> },
  { title: 'tinted · на тёмном', dark: true, node: <Chip label="детектив" onDark /> },
  { title: 'outline · на тёмном', dark: true, node: <Chip label="детектив" kind="outline" onDark /> },
  { title: 'removable · на тёмном', dark: true, node: <Chip label="детектив" kind="removable" onDark /> },
  { title: 'add · на тёмном', dark: true, node: <Chip label="жанр" kind="add" onDark /> },
  { title: 'error · на тёмном', dark: true, node: <Chip label="нет каста" kind="error" onDark /> },
  { title: 'warn · на тёмном', dark: true, node: <Chip label="устарело" kind="warn" onDark /> },
];
