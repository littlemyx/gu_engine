/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CascadeNote from './CascadeNote';

afterEach(cleanup);

const NOTE = 'смена принятого протухнет потомков — покажем перед применением';
const RIGHT = 'храним последние 5 · старшие уходят в GC';

describe('CascadeNote', () => {
  it('показывает пояснение слева', () => {
    render(<CascadeNote note={NOTE} />);
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it('без right вторая колонка не рисуется', () => {
    render(<CascadeNote note={NOTE} />);
    expect(screen.queryByText(RIGHT)).toBeNull();
  });

  it('с right показывает обе колонки', () => {
    render(<CascadeNote note={NOTE} right={RIGHT} />);
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect(screen.getByText(RIGHT)).toBeTruthy();
  });

  it('по умолчанию ширина числовая, переводится в px', () => {
    const { container } = render(<CascadeNote note={NOTE} />);
    const root = container.firstElementChild as HTMLDivElement;
    expect(root.style.width).toBe('520px');
  });

  it('width задаёт произвольную ширину в px', () => {
    const { container } = render(<CascadeNote note={NOTE} width={320} />);
    const root = container.firstElementChild as HTMLDivElement;
    expect(root.style.width).toBe('320px');
  });

  it("width='fill' растягивает строку на 100%", () => {
    const { container } = render(<CascadeNote note={NOTE} width="fill" />);
    const root = container.firstElementChild as HTMLDivElement;
    expect(root.style.width).toBe('100%');
  });

  it('не кликабельный: кнопок нет', () => {
    render(<CascadeNote note={NOTE} right={RIGHT} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
