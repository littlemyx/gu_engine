/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import QARow, { type QARowKind } from './QARow';

afterEach(cleanup);

const KINDS: QARowKind[] = ['ошибка', 'предупреждение', 'ок'];

describe.each(KINDS)('QARow, кind %s', kind => {
  it('показывает заголовок и мету', () => {
    render(<QARow kind={kind} title="Ветка «разрыв»" meta="бит Б5б без прозы" />);
    expect(screen.getByText('Ветка «разрыв»')).toBeTruthy();
    expect(screen.getByText('бит Б5б без прозы')).toBeTruthy();
  });
});

describe('QARow, частные случаи', () => {
  it('без kind по умолчанию ошибка', () => {
    render(<QARow title="Ветка «разрыв»" meta="мета" />);
    expect(screen.getByRole('img', { name: 'fail' })).toBeTruthy();
  });

  it('без action хвост строки не рисуется', () => {
    render(<QARow title="Ветка «разрыв»" meta="мета" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('показать в чертеже')).toBeNull();
  });

  it('action без onAction — статичная подпись, не кнопка', () => {
    render(<QARow title="Ветка «разрыв»" meta="мета" action="показать в чертеже" />);
    expect(screen.getByText('показать в чертеже')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('action c onAction — кнопка, вызывающая колбэк', () => {
    let clicks = 0;
    render(<QARow title="Ветка «разрыв»" meta="мета" action="показать в чертеже" onAction={() => (clicks += 1)} />);
    const button = screen.getByRole('button', { name: 'показать в чертеже' });
    fireEvent.click(button);
    expect(clicks).toBe(1);
  });

  it('kind=предупреждение отдаёт глиф warn', () => {
    render(<QARow kind="предупреждение" title="т" meta="м" />);
    expect(screen.getByRole('img', { name: 'warn' })).toBeTruthy();
  });

  it('kind=ок отдаёт глиф ok', () => {
    render(<QARow kind="ок" title="т" meta="м" />);
    expect(screen.getByRole('img', { name: 'ok' })).toBeTruthy();
  });

  it('onDark по умолчанию false — рендерится без ошибок и на тёмном хроме', () => {
    render(<QARow title="т" meta="м" onDark />);
    expect(screen.getByText('т')).toBeTruthy();
  });
});
