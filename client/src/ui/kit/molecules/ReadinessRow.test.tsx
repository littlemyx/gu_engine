/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ReadinessRow, { type ReadinessRowState } from './ReadinessRow';

afterEach(cleanup);

const STATES: ReadinessRowState[] = ['done', 'problem', 'waiting'];

describe.each(STATES)('ReadinessRow, состояние %s', state => {
  it('показывает текст пункта', () => {
    render(<ReadinessRow text="логлайн и тон" state={state} />);
    expect(screen.getByText('логлайн и тон')).toBeTruthy();
  });
});

describe('ReadinessRow, глиф по состоянию', () => {
  it('готово — галочка', () => {
    render(<ReadinessRow text="сюжет" state="done" />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('проблема — кружок', () => {
    render(<ReadinessRow text="каст" state="problem" />);
    expect(screen.getAllByText('○').length).toBeGreaterThan(0);
  });

  it('ожидает — кружок', () => {
    render(<ReadinessRow text="мир" state="waiting" />);
    expect(screen.getAllByText('○').length).toBeGreaterThan(0);
  });
});

describe('ReadinessRow, дефолт состояния', () => {
  it('без state ведёт себя как «готово»', () => {
    render(<ReadinessRow text="дефолт" />);
    expect(screen.getByText('✓')).toBeTruthy();
  });
});

describe('ReadinessRow, некликабельность', () => {
  it('не рендерит кнопку — строка чек-листа не интерактивна', () => {
    render(<ReadinessRow text="аудио" state="done" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
