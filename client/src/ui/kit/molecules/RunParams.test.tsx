/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import RunParams, { type RunParamRow } from './RunParams';

afterEach(cleanup);

const ROWS: RunParamRow[] = [
  { text: 'ретраи: до 2 попыток/позиция', price: '≈$0.31' },
  { text: 'пауза: после каждой порции', expandable: true },
];

describe('RunParams, контент', () => {
  it('показывает текст каждой строки', () => {
    render(<RunParams rows={ROWS} />);
    expect(screen.getByText('ретраи: до 2 попыток/позиция')).toBeTruthy();
    expect(screen.getByText('пауза: после каждой порции')).toBeTruthy();
  });

  it('показывает цену, когда она задана', () => {
    render(<RunParams rows={ROWS} />);
    expect(screen.getByText('≈$0.31')).toBeTruthy();
  });

  it('без цены цена не рисуется', () => {
    render(<RunParams rows={[{ text: 'пауза: после каждой порции', expandable: true }]} />);
    expect(screen.queryByText('≈$0.31')).toBeNull();
  });

  it('стрелка рисуется только у раскрывающихся строк', () => {
    render(<RunParams rows={ROWS} />);
    expect(screen.getAllByText('▾')).toHaveLength(1);
  });
});

describe('RunParams, направление', () => {
  it('по умолчанию — колонка', () => {
    const { container } = render(<RunParams rows={ROWS} />);
    expect(container.firstElementChild?.className).toMatch(/column/);
  });

  it('direction="row" — строка', () => {
    const { container } = render(<RunParams rows={ROWS} direction="row" />);
    expect(container.firstElementChild?.className).not.toMatch(/column/);
  });
});

describe('RunParams, интерактивность', () => {
  it('нераскрывающаяся строка не рендерится кнопкой', () => {
    render(<RunParams rows={[{ text: 'бюджет ≈$0.31' }]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('раскрывающаяся строка без onPick не рендерится кнопкой', () => {
    render(<RunParams rows={[{ text: 'пауза: после каждой порции', expandable: true }]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('раскрывающаяся строка с onPick рендерится кнопкой и вызывает колбэк с индексом и текстом', () => {
    let calledWith: [number, string] | null = null;
    render(
      <RunParams
        rows={ROWS}
        onPick={(index, text) => {
          calledWith = [index, text];
        }}
      />,
    );
    const button = screen.getByRole('button', { name: /пауза: после каждой порции/ });
    fireEvent.click(button);
    expect(calledWith).toEqual([1, 'пауза: после каждой порции']);
  });
});
