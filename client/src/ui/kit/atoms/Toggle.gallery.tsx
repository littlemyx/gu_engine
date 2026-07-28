import React from 'react';

import Toggle from './Toggle';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Toggle';

export const cases: GalleryCase[] = [
  { title: 'on', node: <Toggle on label="строгий режим" onChange={() => {}} /> },
  { title: 'off', node: <Toggle on={false} label="строгий режим" onChange={() => {}} /> },
  { title: 'hover (наведите курсор)', node: <Toggle on label="строгий режим" onChange={() => {}} /> },
  { title: 'focus (перейдите Tab-ом)', node: <Toggle on={false} label="строгий режим" onChange={() => {}} /> },
  { title: 'disabled, on', node: <Toggle on disabled label="строгий режим" onChange={() => {}} /> },
  { title: 'disabled, off', node: <Toggle on={false} disabled label="строгий режим" onChange={() => {}} /> },
  { title: 'без подписи', node: <Toggle on label="строгий режим" showLabel={false} onChange={() => {}} /> },
];
