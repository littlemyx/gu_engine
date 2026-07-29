/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PreviewControls from './PreviewControls';

afterEach(cleanup);

describe('PreviewControls, состав по умолчанию', () => {
  it('печатает подписи и сид по умолчанию', () => {
    render(<PreviewControls />);

    expect(screen.getByText('Перезапуск с промоткой')).toBeTruthy();
    expect(screen.getByText('ветка: примирение')).toBeTruthy();
    expect(screen.getByText('seed 12345')).toBeTruthy();
    expect(screen.getByText('переролл')).toBeTruthy();
  });

  it('принимает свои подписи, ветку и сид пропсами', () => {
    render(<PreviewControls restartLabel="Перезапуск" branch="месть" seed="98765" rerollLabel="ещё раз" />);

    expect(screen.getByText('Перезапуск')).toBeTruthy();
    expect(screen.getByText('ветка: месть')).toBeTruthy();
    expect(screen.getByText('seed 98765')).toBeTruthy();
    expect(screen.getByText('ещё раз')).toBeTruthy();
  });
});

describe('PreviewControls, кнопка перезапуска', () => {
  it('без onRestart кнопки нет — только текст', () => {
    render(<PreviewControls />);

    expect(screen.queryByRole('button', { name: /Перезапуск с промоткой/ })).toBeNull();
    expect(screen.getByText('Перезапуск с промоткой')).toBeTruthy();
  });

  it('с onRestart клик доходит до колбэка', () => {
    const onRestart = vi.fn();
    render(<PreviewControls onRestart={onRestart} />);

    fireEvent.click(screen.getByRole('button', { name: /Перезапуск с промоткой/ }));

    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});

describe('PreviewControls, кнопка ветки', () => {
  it('без onBranch кнопки нет — только текст', () => {
    render(<PreviewControls />);

    expect(screen.queryByRole('button', { name: /ветка: примирение/ })).toBeNull();
    expect(screen.getByText('ветка: примирение')).toBeTruthy();
  });

  it('с onBranch клик доходит до колбэка', () => {
    const onBranch = vi.fn();
    render(<PreviewControls onBranch={onBranch} />);

    fireEvent.click(screen.getByRole('button', { name: /ветка: примирение/ }));

    expect(onBranch).toHaveBeenCalledTimes(1);
  });
});

describe('PreviewControls, кнопка переролла', () => {
  it('без onReroll кнопки нет — только текст', () => {
    render(<PreviewControls />);

    expect(screen.queryByRole('button', { name: 'переролл' })).toBeNull();
    expect(screen.getByText('переролл')).toBeTruthy();
  });

  it('с onReroll клик доходит до колбэка', () => {
    const onReroll = vi.fn();
    render(<PreviewControls onReroll={onReroll} />);

    fireEvent.click(screen.getByRole('button', { name: 'переролл' }));

    expect(onReroll).toHaveBeenCalledTimes(1);
  });
});

describe('PreviewControls, состояние disabled', () => {
  it('гасит все три кнопки разом', () => {
    const onRestart = vi.fn();
    const onBranch = vi.fn();
    const onReroll = vi.fn();
    render(<PreviewControls disabled onRestart={onRestart} onBranch={onBranch} onReroll={onReroll} />);

    const restart = screen.getByRole('button', { name: /Перезапуск с промоткой/ }) as HTMLButtonElement;
    const branchButton = screen.getByRole('button', { name: /ветка: примирение/ }) as HTMLButtonElement;
    const reroll = screen.getByRole('button', { name: 'переролл' }) as HTMLButtonElement;

    expect(restart.disabled).toBe(true);
    expect(branchButton.disabled).toBe(true);
    expect(reroll.disabled).toBe(true);

    fireEvent.click(restart);
    fireEvent.click(branchButton);
    fireEvent.click(reroll);

    expect(onRestart).not.toHaveBeenCalled();
    expect(onBranch).not.toHaveBeenCalled();
    expect(onReroll).not.toHaveBeenCalled();
  });
});
