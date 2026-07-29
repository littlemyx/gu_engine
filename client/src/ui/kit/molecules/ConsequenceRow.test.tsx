/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ConsequenceRow, { type ConsequenceRowGlyph } from './ConsequenceRow';

afterEach(cleanup);

const GLYPHS: ConsequenceRowGlyph[] = ['◐', '●', '▣', '✎'];

describe.each(GLYPHS)('ConsequenceRow, глиф %s', glyph => {
  it('показывает глиф вместе с текстом и действие', () => {
    render(<ConsequenceRow glyph={glyph} text="протухнут 44 юнита" action="довести ≈$5.10" />);
    expect(screen.getByText(`${glyph} протухнут 44 юнита`)).toBeTruthy();
    expect(screen.getByText('довести ≈$5.10')).toBeTruthy();
  });
});

describe('ConsequenceRow, тон', () => {
  it('активная строка не имеет класса muted у текста', () => {
    render(<ConsequenceRow text="прозы хватит" action="довести ≈$5.10" active />);
    const body = screen.getByText('◐ прозы хватит');
    expect(body.className).not.toMatch(/muted/);
  });

  it('тихая строка красит текст приглушённым тоном', () => {
    render(<ConsequenceRow text="прозы хватит" action="довести ≈$5.10" active={false} />);
    const body = screen.getByText('◐ прозы хватит');
    expect(body.className).toMatch(/muted/);
  });
});

describe('ConsequenceRow, разделитель', () => {
  it('по умолчанию рисует нижнюю границу', () => {
    const { container } = render(<ConsequenceRow text="строка" action="действие" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/divider/);
  });

  it('divider=false убирает класс границы', () => {
    const { container } = render(<ConsequenceRow text="строка" action="действие" divider={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/divider/);
  });
});

describe('ConsequenceRow, некликабельность', () => {
  it('не рендерит ни одной кнопки — строка не интерактивна', () => {
    render(<ConsequenceRow text="строка" action="действие" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
