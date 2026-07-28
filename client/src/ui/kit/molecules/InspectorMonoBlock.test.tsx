/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import InspectorMonoBlock from './InspectorMonoBlock';

afterEach(cleanup);

const LINES = ['рождён прогоном #9 · промпт v3', 'вход: beatText Б4 · окно Д5в', 'цена $0.021 · отпечаток 4f2a…'];

describe('InspectorMonoBlock', () => {
  it('печатает каждую строку отдельно', () => {
    render(<InspectorMonoBlock lines={LINES} />);
    LINES.forEach(line => {
      expect(screen.getByText(line)).toBeTruthy();
    });
  });

  it('по умолчанию живёт на тёмном хроме', () => {
    const { container } = render(<InspectorMonoBlock lines={LINES} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/onDark/);
  });

  it('onDark=false переключает на светлый хром', () => {
    const { container } = render(<InspectorMonoBlock lines={LINES} onDark={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/onDark/);
  });

  it('по умолчанию рамка есть', () => {
    const { container } = render(<InspectorMonoBlock lines={LINES} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/framed/);
  });

  it('framed=false снимает рамку', () => {
    const { container } = render(<InspectorMonoBlock lines={LINES} framed={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/framed/);
  });

  it('без width блок растягивается на всю ширину', () => {
    const { container } = render(<InspectorMonoBlock lines={LINES} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('100%');
  });

  it('width задаёт фиксированную ширину в px', () => {
    const { container } = render(<InspectorMonoBlock lines={LINES} width={240} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('240px');
  });

  it('блок не интерактивен: кнопок нет', () => {
    render(<InspectorMonoBlock lines={LINES} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('пустой список строк не падает и не рисует строк', () => {
    const { container } = render(<InspectorMonoBlock lines={[]} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.children.length).toBe(0);
  });
});
