/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BugReportButton from './BugReportButton';

afterEach(cleanup);

describe('BugReportButton', () => {
  it('показывает подпись по умолчанию', () => {
    render(<BugReportButton onClick={() => {}} />);
    expect(screen.getByText('Баг-репорт: seed + лог 23 выборов → заметка на юнит')).toBeTruthy();
  });

  it('показывает переданную подпись и глиф', () => {
    render(<BugReportButton label="Скопировать лог" glyph="✎" onClick={() => {}} />);
    expect(screen.getByText('Скопировать лог')).toBeTruthy();
    expect(screen.getByText('✎')).toBeTruthy();
  });

  it('вызывает колбэк по клику', () => {
    const onClick = vi.fn();
    render(<BugReportButton label="Баг-репорт" onClick={onClick} />);
    screen.getByRole('button', { name: /Баг-репорт/ }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('без колбэка не рендерит кнопку', () => {
    render(<BugReportButton label="Баг-репорт" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Баг-репорт')).toBeTruthy();
  });

  it('в состоянии disabled кнопка выключена и колбэк не срабатывает', () => {
    const onClick = vi.fn();
    render(<BugReportButton label="Баг-репорт" disabled onClick={onClick} />);
    const button = screen.getByRole('button', { name: /Баг-репорт/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('без колбэка и с disabled помечает элемент aria-disabled', () => {
    render(<BugReportButton label="Баг-репорт" disabled />);
    const el = screen.getByText('Баг-репорт').closest('span[aria-disabled]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-disabled')).toBe('true');
  });
});
