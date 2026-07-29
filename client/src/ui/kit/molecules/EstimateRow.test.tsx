/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EstimateRow, { type EstimateRowFrame, type EstimateRowKind } from './EstimateRow';

afterEach(cleanup);

const KINDS: EstimateRowKind[] = ['position', 'cascade', 'group', 'locked'];
const FRAMES: EstimateRowFrame[] = ['around', 'bottom', 'none'];

describe.each(KINDS)('EstimateRow, kind %s', kind => {
  it('показывает текст строки', () => {
    render(<EstimateRow text="Проза бита Б5 «Ссора»" kind={kind} />);
    expect(screen.getByText('Проза бита Б5 «Ссора»')).toBeTruthy();
  });

  it('без колбэка рендерится как нейтральный контейнер, не кнопка', () => {
    render(<EstimateRow text="строка" kind={kind} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с колбэком становится кнопкой и вызывает его по клику', () => {
    const onClick = vi.fn();
    render(<EstimateRow text="строка" kind={kind} onClick={onClick} />);

    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe.each(FRAMES)('EstimateRow, frame %s', frame => {
  it('применяет соответствующий модификатор обвода', () => {
    const { container } = render(<EstimateRow text="строка" frame={frame} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(
      new RegExp(frame === 'around' ? 'frameAround' : frame === 'bottom' ? 'frameBottom' : 'frameNone'),
    );
  });
});

describe('EstimateRow, цена', () => {
  it('показывает цену у позиции верхнего уровня', () => {
    render(<EstimateRow text="Концовки" kind="position" price="≈$0.30" />);
    expect(screen.getByText('≈$0.30')).toBeTruthy();
  });

  it('без цены — цена не рендерится', () => {
    render(<EstimateRow text="Концовки" kind="position" />);
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('у свёрнутой группы цена не показывается, даже если передана', () => {
    render(<EstimateRow text="ещё 7 позиций" kind="group" price="≈$0.30" />);
    expect(screen.queryByText('≈$0.30')).toBeNull();
  });

  it('у залоченной группы показывает цену $0', () => {
    render(<EstimateRow text="Залочено — пропускаем" kind="locked" price="$0" />);
    expect(screen.getByText('$0')).toBeTruthy();
  });
});

describe('EstimateRow, частные случаи содержимого', () => {
  it('каскад учитывает ступень отступа через IndentSpacer', () => {
    const { container } = render(<EstimateRow text="unit_kira_s2_pier" kind="cascade" indentLevel={3} />);
    const spacer = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(spacer.style.width).toBe('42px');
  });

  it('свёрнутая группа несёт декоративную стрелку раскрытия', () => {
    render(<EstimateRow text="ещё 7 позиций" kind="group" />);
    expect(screen.getByText('▸')).toBeTruthy();
  });
});
