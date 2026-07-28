/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EmptyState, { type EmptyStateActionKind } from './EmptyState';

afterEach(cleanup);

const TITLE = 'Чертёж пуст';
const HINT = 'хребта ещё нет — его строит генерация плана';
const ACTION_LABEL = '▶ Сгенерировать план';

const ACTION_KINDS: EmptyStateActionKind[] = ['primary', 'outline'];

describe.each(ACTION_KINDS)('EmptyState, вид кнопки %s', actionKind => {
  it('показывает заголовок, подсказку и кнопку действия', () => {
    render(
      <EmptyState title={TITLE} hint={HINT} actionLabel={ACTION_LABEL} actionKind={actionKind} onAction={() => {}} />,
    );

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(screen.getByRole('button', { name: ACTION_LABEL })).toBeTruthy();
  });

  it('клик по кнопке действия вызывает колбэк', () => {
    const onAction = vi.fn();
    render(
      <EmptyState title={TITLE} hint={HINT} actionLabel={ACTION_LABEL} actionKind={actionKind} onAction={onAction} />,
    );

    screen.getByRole('button', { name: ACTION_LABEL }).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState, кнопка без колбэка', () => {
  it('primary остаётся кнопкой даже без onAction', () => {
    render(<EmptyState title={TITLE} hint={HINT} actionLabel={ACTION_LABEL} actionKind="primary" />);

    expect(screen.getByRole('button', { name: ACTION_LABEL })).toBeTruthy();
  });

  it('outline без onAction не рендерит кнопку', () => {
    render(<EmptyState title={TITLE} hint={HINT} actionLabel={ACTION_LABEL} actionKind="outline" />);

    expect(screen.queryByRole('button', { name: ACTION_LABEL })).toBeNull();
    expect(screen.getByText(ACTION_LABEL)).toBeTruthy();
  });
});

describe('EmptyState, контекст', () => {
  it('на светлом хроме по умолчанию', () => {
    const { container } = render(<EmptyState title={TITLE} hint={HINT} actionLabel={ACTION_LABEL} />);

    expect(container.firstElementChild?.className).not.toMatch(/onDark/);
  });

  it('на тёмном хроме по явному пропу', () => {
    const { container } = render(<EmptyState title={TITLE} hint={HINT} actionLabel={ACTION_LABEL} onDark />);

    expect(container.firstElementChild?.className).toMatch(/onDark/);
  });
});
