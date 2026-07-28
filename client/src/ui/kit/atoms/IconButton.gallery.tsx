import React from 'react';

import IconButton from './IconButton';

import type { GalleryCase } from '../galleryTypes';

export const title = 'IconButton';

export const cases: GalleryCase[] = [
  { title: 'строчная · neutral', node: <IconButton glyph="⟳" hint="Обновить" onClick={() => {}} /> },
  {
    title: 'строчная · danger',
    node: <IconButton glyph="✕" hint="Удалить" tone="danger" onClick={() => {}} />,
  },
  { title: 'тулбарная · neutral', node: <IconButton glyph="⟳" hint="Обновить" size="toolbar" onClick={() => {}} /> },
  {
    title: 'тулбарная · danger',
    node: <IconButton glyph="✕" hint="Удалить" size="toolbar" tone="danger" onClick={() => {}} />,
  },
  { title: 'disabled', node: <IconButton glyph="⟳" hint="Обновить" size="toolbar" disabled onClick={() => {}} /> },
  { title: 'без колбэка', node: <IconButton glyph="⋯" hint="Ещё" size="toolbar" /> },
  {
    title: 'строчная · neutral · на тёмном',
    dark: true,
    node: <IconButton glyph="⟳" hint="Обновить" onDark onClick={() => {}} />,
  },
  {
    title: 'строчная · danger · на тёмном',
    dark: true,
    node: <IconButton glyph="✕" hint="Удалить" tone="danger" onDark onClick={() => {}} />,
  },
  {
    title: 'тулбарная · neutral · на тёмном',
    dark: true,
    node: <IconButton glyph="⟳" hint="Обновить" size="toolbar" onDark onClick={() => {}} />,
  },
  {
    title: 'тулбарная · danger · на тёмном',
    dark: true,
    node: <IconButton glyph="✕" hint="Удалить" size="toolbar" tone="danger" onDark onClick={() => {}} />,
  },
  {
    title: 'disabled · на тёмном',
    dark: true,
    node: <IconButton glyph="⟳" hint="Обновить" size="toolbar" onDark disabled onClick={() => {}} />,
  },
];
