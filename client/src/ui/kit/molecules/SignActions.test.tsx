/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SignActions from './SignActions';

afterEach(cleanup);

const buttons = () => screen.getAllByRole('button') as HTMLButtonElement[];
const confirmButton = (label = 'Подписать смету и запустить') => buttons().find(b => b.textContent?.includes(label))!;

describe('SignActions, состав', () => {
  it('печатает подписи по умолчанию', () => {
    render(<SignActions onCancel={() => {}} onConfirm={() => {}} />);

    expect(screen.getByRole('button', { name: 'Отмена' })).toBeTruthy();
    expect(confirmButton().textContent).toContain('Подписать смету и запустить');
  });

  it('принимает свои тексты и смету пропсами', () => {
    render(
      <SignActions
        cancelLabel="Не сейчас"
        confirmLabel="Подписать акт"
        price="≈$1.10"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Не сейчас' })).toBeTruthy();
    expect(confirmButton('Подписать акт').textContent).toContain('Подписать акт');
    expect(confirmButton('Подписать акт').textContent).toContain('≈$1.10');
  });

  it('без сметы кнопка подтверждения её не печатает', () => {
    render(<SignActions onCancel={() => {}} onConfirm={() => {}} />);

    expect(confirmButton().textContent).toBe('Подписать смету и запустить');
  });
});

describe('SignActions, колбэки', () => {
  it('клик по «Отмена» вызывает onCancel', () => {
    const onCancel = vi.fn();
    render(<SignActions onCancel={onCancel} onConfirm={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('клик по кнопке подтверждения вызывает onConfirm', () => {
    const onConfirm = vi.fn();
    render(<SignActions onCancel={() => {}} onConfirm={onConfirm} />);

    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // OutlineButton (атом «Отмена») без колбэка рендерит неинтерактивный <span> —
  // так уже устроен сам атом, молекула этого не переопределяет.
  it('без onCancel кнопка «Отмена» не интерактивна', () => {
    render(<SignActions onConfirm={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Отмена' })).toBeNull();
    expect(screen.getByText('Отмена')).toBeTruthy();
  });
});

describe('SignActions, состояния кнопки подтверждения', () => {
  it('disabled запирает кнопку подтверждения и не пускает клик', () => {
    const onConfirm = vi.fn();
    render(<SignActions disabled onConfirm={onConfirm} onCancel={() => {}} />);

    expect(confirmButton().disabled).toBe(true);
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('loading не отключает кнопку, но клик всё равно не проходит', () => {
    const onConfirm = vi.fn();
    render(<SignActions loading onConfirm={onConfirm} onCancel={() => {}} />);

    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('кнопка «Отмена» остаётся доступной, пока подтверждение занято', () => {
    const onCancel = vi.fn();
    render(<SignActions loading onCancel={onCancel} onConfirm={() => {}} />);

    const cancel = screen.getByRole('button', { name: 'Отмена' }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
