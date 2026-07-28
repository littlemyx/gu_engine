/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SearchField, { type SearchFieldState } from './SearchField';

afterEach(cleanup);

const STATES: SearchFieldState[] = ['обычный', 'disabled', 'error'];

describe.each(STATES)('SearchField, состояние %s', state => {
  it('передаёт состояние во вложенное поле', () => {
    render(<SearchField placeholder="поиск по истории…" state={state} />);

    const input = screen.getByPlaceholderText('поиск по истории…') as HTMLInputElement;
    expect(input.disabled).toBe(state === 'disabled');
  });
});

describe('SearchField, частности', () => {
  it('оборачивает поле в role="search"', () => {
    render(<SearchField />);

    expect(screen.getByRole('search')).toBeTruthy();
  });

  it('плейсхолдер по умолчанию — «поиск по истории…»', () => {
    render(<SearchField />);

    expect(screen.getByPlaceholderText('поиск по истории…')).toBeTruthy();
  });

  it('плейсхолдер приходит пропом', () => {
    render(<SearchField placeholder="поиск: персонаж, мир, аудио…" />);

    expect(screen.getByPlaceholderText('поиск: персонаж, мир, аудио…')).toBeTruthy();
  });

  it('несёт начальное значение', () => {
    render(<SearchField value="детектив" />);

    const input = screen.getByPlaceholderText('поиск по истории…') as HTMLInputElement;
    expect(input.value).toBe('детектив');
  });

  it('вызывает onChange со значением поля', () => {
    const onChange = vi.fn();
    render(<SearchField onChange={onChange} />);

    const input = screen.getByPlaceholderText('поиск по истории…');
    fireEvent.change(input, { target: { value: 'магия' } });

    expect(onChange).toHaveBeenCalledWith('магия');
  });
});
