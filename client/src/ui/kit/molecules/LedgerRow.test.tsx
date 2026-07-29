/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LedgerRow, { type LedgerRowState } from './LedgerRow';

afterEach(cleanup);

const STATES: LedgerRowState[] = ['готово', 'пишется', 'очередь'];

describe.each(STATES)('LedgerRow, состояние %s', state => {
  it('показывает артефакт и дефолтные подписи колонок', () => {
    render(<LedgerRow artifact="unit_kira_s2_cafe" state={state} />);

    expect(screen.getByText('unit_kira_s2_cafe')).toBeTruthy();
  });

  it('не рендерит кнопку без onClick', () => {
    render(<LedgerRow artifact="unit_kira_s2_cafe" state={state} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('кликается, когда передан onClick', () => {
    const onClick = vi.fn();
    render(<LedgerRow artifact="unit_kira_s2_cafe" state={state} onClick={onClick} />);

    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('unit_kira_s2_cafe');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('LedgerRow, «готово»', () => {
  it('дефолты: предложено / №1 / $0.014 / готово', () => {
    render(<LedgerRow artifact="unit_kira_s2_cafe" state="готово" />);

    expect(screen.getByText('предложено')).toBeTruthy();
    expect(screen.getByText('№1')).toBeTruthy();
    expect(screen.getByText('$0.014')).toBeTruthy();
    expect(screen.getByText('готово')).toBeTruthy();
  });

  it('показывает глиф статуса', () => {
    render(<LedgerRow artifact="unit_kira_s2_cafe" state="готово" />);

    expect(screen.getByRole('img')).toBeTruthy();
  });
});

describe('LedgerRow, «пишется»', () => {
  it('дефолты: черновик / … / пишется', () => {
    render(<LedgerRow artifact="unit_kira_s2_cafe" state="пишется" />);

    expect(screen.getByText('черновик')).toBeTruthy();
    expect(screen.getByText('…')).toBeTruthy();
    expect(screen.getByText('пишется')).toBeTruthy();
  });

  it('глиф статуса крутится', () => {
    render(<LedgerRow artifact="unit_kira_s2_cafe" state="пишется" />);

    const glyph = screen.getByRole('img');
    expect(glyph.className).toMatch(/spin/);
  });
});

describe('LedgerRow, «очередь»', () => {
  it('дефолты: — / — / — / в очереди, без глифа статуса', () => {
    render(<LedgerRow artifact="unit_kira_s2_cafe" state="очередь" />);

    expect(screen.getByText('в очереди')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('LedgerRow, переопределения пропсов', () => {
  it('source/take/price/status перекрывают дефолт состояния', () => {
    render(
      <LedgerRow
        artifact="unit_kira_s2_cafe"
        state="готово"
        source="архив"
        take="№3"
        price="$0.02"
        status="проверено"
      />,
    );

    expect(screen.getByText('архив')).toBeTruthy();
    expect(screen.getByText('№3')).toBeTruthy();
    expect(screen.getByText('$0.02')).toBeTruthy();
    expect(screen.getByText('проверено')).toBeTruthy();
    expect(screen.queryByText('предложено')).toBeNull();
  });

  it('colWidths применяются к колонкам-контейнерам', () => {
    const { container } = render(
      <LedgerRow artifact="unit_kira_s2_cafe" state="готово" colWidths={[120, 80, 50, 70]} />,
    );

    const cols = container.querySelectorAll('span[style*="width"]');
    expect(cols.length).toBeGreaterThan(0);
    expect(Array.from(cols).some(el => (el as HTMLElement).style.width === '120px')).toBe(true);
  });

  it('expanded меняет класс корня (нет нижней рамки)', () => {
    const { container: plain } = render(<LedgerRow artifact="unit_kira_s2_cafe" state="готово" />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: expanded } = render(<LedgerRow artifact="unit_kira_s2_cafe" state="готово" expanded />);
    expect(expanded.firstElementChild?.className).not.toBe(plainClass);
  });
});
