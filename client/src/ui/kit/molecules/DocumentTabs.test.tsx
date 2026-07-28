/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DocumentTabs, { type DocumentTabsItem } from './DocumentTabs';

afterEach(cleanup);

const TABS: DocumentTabsItem[] = [
  { label: 'Чертёж' },
  { label: 'Партитура' },
  { label: 'Сценарий' },
  { label: 'Карта' },
];

const tab = (name: string) => screen.getByRole('tab', { name }) as HTMLElement;

describe('DocumentTabs', () => {
  it('показывает все вкладки и подсвечивает активную', () => {
    render(<DocumentTabs tabs={TABS} active={1} onPick={() => {}} />);

    expect(tab('Чертёж').getAttribute('aria-selected')).toBe('false');
    expect(tab('Партитура').getAttribute('aria-selected')).toBe('true');
    expect(tab('Сценарий').getAttribute('aria-selected')).toBe('false');
  });

  it('по умолчанию активна первая вкладка', () => {
    render(<DocumentTabs tabs={TABS} onPick={() => {}} />);

    expect(tab('Чертёж').getAttribute('aria-selected')).toBe('true');
  });

  it('клик по вкладке зовёт onPick с индексом и меткой', () => {
    const onPick = vi.fn();
    render(<DocumentTabs tabs={TABS} active={0} onPick={onPick} />);

    tab('Карта').click();

    expect(onPick).toHaveBeenCalledWith(3, 'Карта');
  });

  it('без onPick вкладки не кликабельны', () => {
    render(<DocumentTabs tabs={TABS} active={0} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(tab('Чертёж').tagName).toBe('SPAN');
  });

  it('вкладки не показывают крестик закрытия', () => {
    const { container } = render(<DocumentTabs tabs={TABS} active={0} onPick={() => {}} />);

    expect(container.querySelector('[aria-label="закрыть"]')).toBeNull();
  });

  it('right показывает пояснение у правого края', () => {
    render(<DocumentTabs tabs={TABS} active={0} right="сохранено" />);

    expect(screen.getByText('сохранено')).toBeTruthy();
  });

  it('без right пояснения нет', () => {
    render(<DocumentTabs tabs={TABS} active={0} />);

    expect(screen.queryByText('сохранено')).toBeNull();
  });
});
