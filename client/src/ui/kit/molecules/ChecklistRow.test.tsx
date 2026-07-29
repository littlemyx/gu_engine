/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ChecklistRow, { type ChecklistRowState } from './ChecklistRow';

afterEach(cleanup);

const STATES: ChecklistRowState[] = ['ready', 'warning', 'problem', 'pending'];

describe.each(STATES)('ChecklistRow, состояние %s', state => {
  it('показывает заголовок, мету и доступное имя глифа', () => {
    render(<ChecklistRow title="мир" meta="университет · bittersweet · 3 темы" state={state} />);
    expect(screen.getByText('мир')).toBeTruthy();
    expect(screen.getByText('университет · bittersweet · 3 темы')).toBeTruthy();
    expect(screen.getByRole('img')).toBeTruthy();
  });
});

describe('ChecklistRow, частные случаи', () => {
  it('без state по умолчанию ready', () => {
    render(<ChecklistRow title="спайн" meta="готово" />);
    expect(screen.getByRole('img', { name: 'ok' })).toBeTruthy();
  });

  it('state=warning отдаёт глиф warn', () => {
    render(<ChecklistRow title="спайн" meta="есть замечания" state="warning" />);
    expect(screen.getByRole('img', { name: 'warn' })).toBeTruthy();
  });

  it('state=problem отдаёт глиф fail', () => {
    render(<ChecklistRow title="спайн" meta="ошибка" state="problem" />);
    expect(screen.getByRole('img', { name: 'fail' })).toBeTruthy();
  });

  it('state=pending отдаёт глиф none', () => {
    render(<ChecklistRow title="спайн" meta="не создано" state="pending" />);
    expect(screen.getByRole('img', { name: 'none' })).toBeTruthy();
  });

  it('строка не интерактивна: кнопок нет', () => {
    render(<ChecklistRow title="спайн" meta="готово" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('по умолчанию живёт на тёмном хроме', () => {
    render(<ChecklistRow title="спайн" meta="готово" />);
    expect(screen.getByText('спайн').closest('div')?.className).toContain('onDark');
  });

  it('onDark={false} снимает класс тёмного хрома', () => {
    render(<ChecklistRow title="спайн" meta="готово" onDark={false} />);
    expect(screen.getByText('спайн').closest('div')?.className).not.toContain('onDark');
  });
});
