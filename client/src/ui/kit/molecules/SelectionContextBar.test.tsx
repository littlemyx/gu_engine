/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SelectionContextBar from './SelectionContextBar';

afterEach(cleanup);

const BASE_PROPS = {
  path: 'Акт II › слот Д5в › Б5 «Ссора»',
  playLabel: '▶ Играть отсюда',
  retakeLabel: '⟳ Дубль ≈$0.02',
};

describe('SelectionContextBar', () => {
  it('показывает префикс по умолчанию и путь по сегментам', () => {
    render(<SelectionContextBar {...BASE_PROPS} />);
    expect(screen.getByText('Выбрано:')).toBeTruthy();
    expect(screen.getByText('Акт II')).toBeTruthy();
    expect(screen.getByText('слот Д5в')).toBeTruthy();
    expect(screen.getByText('Б5 «Ссора»')).toBeTruthy();
  });

  it('принимает кастомный префикс', () => {
    render(<SelectionContextBar {...BASE_PROPS} prefix="Курсор:" />);
    expect(screen.getByText('Курсор:')).toBeTruthy();
    expect(screen.queryByText('Выбрано:')).toBeNull();
  });

  it('без note заметка не рендерится', () => {
    render(<SelectionContextBar {...BASE_PROPS} />);
    expect(screen.queryByText('кадр не сгенерирован')).toBeNull();
  });

  it('с note заметка показывается рядом с путём', () => {
    render(<SelectionContextBar {...BASE_PROPS} note="кадр не сгенерирован" />);
    expect(screen.getByText('кадр не сгенерирован')).toBeTruthy();
  });

  it('с колбэками показывает обе кнопки как интерактивные', () => {
    render(<SelectionContextBar {...BASE_PROPS} onPlay={() => {}} onRetake={() => {}} />);
    expect(screen.getByRole('button', { name: BASE_PROPS.playLabel })).toBeTruthy();
    expect(screen.getByRole('button', { name: BASE_PROPS.retakeLabel })).toBeTruthy();
  });

  it('кнопка «играть» вызывает onPlay', () => {
    const onPlay = vi.fn();
    render(<SelectionContextBar {...BASE_PROPS} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole('button', { name: BASE_PROPS.playLabel }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('кнопка «дубль» вызывает onRetake', () => {
    const onRetake = vi.fn();
    render(<SelectionContextBar {...BASE_PROPS} onRetake={onRetake} />);
    fireEvent.click(screen.getByRole('button', { name: BASE_PROPS.retakeLabel }));
    expect(onRetake).toHaveBeenCalledTimes(1);
  });

  it('без колбэков кнопки не интерактивны', () => {
    render(<SelectionContextBar {...BASE_PROPS} />);
    expect(screen.queryByRole('button', { name: BASE_PROPS.playLabel })).toBeNull();
    expect(screen.queryByRole('button', { name: BASE_PROPS.retakeLabel })).toBeNull();
    expect(screen.getByText(BASE_PROPS.playLabel)).toBeTruthy();
    expect(screen.getByText(BASE_PROPS.retakeLabel)).toBeTruthy();
  });
});
