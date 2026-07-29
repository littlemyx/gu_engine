import React from 'react';

import ModalFooter from './ModalFooter';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ModalFooter';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · с чертой',
    node: <ModalFooter onCancel={() => {}} onConfirm={() => {}} />,
  },
  {
    title: 'без черты сверху',
    node: <ModalFooter divider={false} onCancel={() => {}} onConfirm={() => {}} />,
  },
  {
    title: 'со сметой',
    node: <ModalFooter confirmLabel="Сгенерировать" price="120 кр" onCancel={() => {}} onConfirm={() => {}} />,
  },
  {
    title: 'кастомные подписи',
    node: <ModalFooter cancelLabel="Отмена" confirmLabel="Сохранить" onCancel={() => {}} onConfirm={() => {}} />,
  },
  {
    title: 'disabled',
    node: <ModalFooter disabled onCancel={() => {}} onConfirm={() => {}} />,
  },
  {
    title: 'loading',
    node: <ModalFooter loading onCancel={() => {}} onConfirm={() => {}} />,
  },
  {
    title: 'узкий (260px)',
    node: <ModalFooter width={260} onCancel={() => {}} onConfirm={() => {}} />,
  },
];
