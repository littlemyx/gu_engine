import React from 'react';

import BugReportButton from './BugReportButton';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BugReportButton';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию',
    node: <BugReportButton onClick={() => {}} />,
  },
  {
    title: 'короткая подпись и свой глиф',
    node: <BugReportButton label="Скопировать лог" glyph="✎" onClick={() => {}} />,
  },
  {
    title: 'disabled',
    node: <BugReportButton label="Баг-репорт недоступен" disabled onClick={() => {}} />,
  },
  {
    title: 'без колбэка',
    node: <BugReportButton label="Только текст, не кликается" />,
  },
];
