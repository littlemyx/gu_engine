import React from 'react';

import Tab from './Tab';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Tab';

export const cases: GalleryCase[] = [
  {
    title: 'underline · выбрана',
    dark: true,
    node: <Tab label="Сцена" variant="underline" selected onClick={() => {}} />,
  },
  {
    title: 'underline · не выбрана',
    dark: true,
    node: <Tab label="Партитура" variant="underline" onClick={() => {}} />,
  },
  {
    title: 'underline · notify',
    dark: true,
    node: <Tab label="Сценарий" variant="underline" notify onClick={() => {}} />,
  },
  {
    title: 'document · выбрана, с ✕',
    node: <Tab label="brief.md" variant="document" selected onClick={() => {}} onClose={() => {}} />,
  },
  {
    title: 'document · не выбрана, с ✕',
    node: <Tab label="outline.json" variant="document" onClick={() => {}} onClose={() => {}} />,
  },
  {
    title: 'document · без ✕ (closable=false)',
    node: <Tab label="calendar.json" variant="document" closable={false} onClick={() => {}} />,
  },
  {
    title: 'dock · выбрана',
    dark: true,
    node: <Tab label="Консоль" variant="dock" selected onClick={() => {}} />,
  },
  {
    title: 'dock · не выбрана',
    dark: true,
    node: <Tab label="Лог прогона" variant="dock" onClick={() => {}} />,
  },
  {
    title: 'dock · notify',
    dark: true,
    node: <Tab label="Стоимость" variant="dock" notify onClick={() => {}} />,
  },
  {
    title: 'focus (клавиатурная навигация)',
    node: <Tab label="brief.md" variant="document" selected onClick={() => {}} onClose={() => {}} />,
  },
  {
    title: 'без onClick — неинтерактивная вкладка',
    node: <Tab label="Только просмотр" variant="document" />,
  },
];
