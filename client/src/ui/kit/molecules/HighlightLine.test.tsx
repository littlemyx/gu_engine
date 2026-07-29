/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import HighlightLine, { type HighlightLineKind } from './HighlightLine';

afterEach(cleanup);

const KINDS: HighlightLineKind[] = ['quote', 'editor'];

describe.each(KINDS)('HighlightLine, вид %s', kind => {
  it('показывает подсвеченный фрагмент внутри реплики', () => {
    render(<HighlightLine kind={kind} before="КИРА: «" highlight="Вы ведь обещали" after=" вернуться»" />);
    expect(screen.getByText('Вы ведь обещали').tagName).toBe('B');
    expect(screen.getByText('КИРА: «', { exact: false })).toBeTruthy();
  });
});

describe('HighlightLine, вид «цитата»', () => {
  it('показывает строку-источник, когда post задан', () => {
    render(<HighlightLine highlight="текст" post="источник: сцена 4" />);
    expect(screen.getByText('источник: сцена 4')).toBeTruthy();
  });

  it('не рендерит строку-источник по умолчанию', () => {
    render(<HighlightLine highlight="текст" />);
    expect(screen.queryByText(/источник/)).toBeNull();
  });

  it('игнорирует pre и cursor — они только для редактора', () => {
    render(<HighlightLine highlight="текст" pre="ремарка" cursor />);
    expect(screen.queryByText('ремарка')).toBeNull();
  });
});

describe('HighlightLine, вид «редактор»', () => {
  it('показывает строку pre, когда она задана', () => {
    render(<HighlightLine kind="editor" highlight="текст" pre="дубль 2" />);
    expect(screen.getByText('дубль 2')).toBeTruthy();
  });

  it('не рендерит курсор по умолчанию', () => {
    const { container } = render(<HighlightLine kind="editor" highlight="текст" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('рендерит мигающий курсор, когда cursor=true', () => {
    const { container } = render(<HighlightLine kind="editor" highlight="текст" cursor />);
    expect(container.textContent).toContain('▌');
  });
});

describe('HighlightLine, ширина', () => {
  it('без width растягивается на 100%', () => {
    const { container } = render(<HighlightLine highlight="текст" />);
    const box = container.firstChild?.firstChild as HTMLElement;
    expect(box.style.width).toBe('');
  });

  it('с width задаёт фиксированную ширину в px', () => {
    const { container } = render(<HighlightLine highlight="текст" width={320} />);
    const box = container.firstChild?.firstChild as HTMLElement;
    expect(box.style.width).toBe('320px');
  });
});
