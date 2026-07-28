/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import HierarchyRow, { type HierarchyRowState } from './HierarchyRow';

afterEach(cleanup);

const STATES: HierarchyRowState[] = ['normal', 'selected', 'failed', 'running', 'dim'];

describe.each(STATES)('HierarchyRow, состояние %s', state => {
  it('показывает подпись и счётчик', () => {
    render(<HierarchyRow label="порция 2 · ступень 2 · Кира" meta="4/9" state={state} />);
    expect(screen.getByText('порция 2 · ступень 2 · Кира')).toBeTruthy();
    expect(screen.getByText('4/9')).toBeTruthy();
  });
});

describe('HierarchyRow, частные случаи', () => {
  it('без onClick рисует неинтерактивную строку', () => {
    render(<HierarchyRow label="сцена" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рисует кнопку и вызывает колбэк по клику', () => {
    let clicked = 0;
    render(
      <HierarchyRow
        label="сцена"
        onClick={() => {
          clicked += 1;
        }}
      />,
    );
    const button = screen.getByRole('button', { name: 'сцена' });
    fireEvent.click(button);
    expect(clicked).toBe(1);
  });

  it('пустой meta не рисует счётчик', () => {
    render(<HierarchyRow label="сцена" meta="" />);
    expect(screen.queryByText('4/9')).toBeNull();
  });

  it('иконка по умолчанию — точка', () => {
    render(<HierarchyRow label="сцена" />);
    expect(screen.getByText('·')).toBeTruthy();
  });

  it('пользовательская иконка отображается', () => {
    render(<HierarchyRow label="сцена" icon="⟳" state="running" />);
    expect(screen.getByText('⟳')).toBeTruthy();
  });

  it('depth задаёт ширину отступа IndentSpacer в 13px на ступень', () => {
    const { container } = render(<HierarchyRow label="сцена" depth={2} />);
    const spacers = Array.from(container.querySelectorAll('[aria-hidden="true"]')) as HTMLElement[];
    const indent = spacers.find(el => el.style.width === '26px');
    expect(indent).toBeTruthy();
  });

  it('depth по умолчанию — 0, отступа нет', () => {
    const { container } = render(<HierarchyRow label="сцена" />);
    const spacers = Array.from(container.querySelectorAll('[aria-hidden="true"]')) as HTMLElement[];
    const indent = spacers.find(el => el.style.width === '0px');
    expect(indent).toBeTruthy();
  });
});
