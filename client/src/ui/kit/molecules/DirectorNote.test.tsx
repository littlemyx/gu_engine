/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DirectorNote from './DirectorNote';

afterEach(cleanup);

describe('DirectorNote, режим quote', () => {
  it('показывает текст в кавычках', () => {
    render(<DirectorNote text="меньше пафоса, без крика" />);
    expect(screen.getByText('«меньше пафоса, без крика»')).toBeTruthy();
  });

  it('без hint не показывает стрелку', () => {
    render(<DirectorNote text="реплика" />);
    expect(screen.queryByText(/→/)).toBeNull();
  });

  it('с hint показывает стрелку с пояснением', () => {
    render(<DirectorNote text="реплика" hint="уйдёт в следующий дубль" />);
    expect(screen.getByText('→ уйдёт в следующий дубль')).toBeTruthy();
  });
});

describe('DirectorNote, режим add', () => {
  it('показывает текст без кавычек', () => {
    render(<DirectorNote kind="add" text="добавить заметку" />);
    expect(screen.getByText('добавить заметку')).toBeTruthy();
    expect(screen.queryByText('«добавить заметку»')).toBeNull();
  });

  it('игнорирует hint', () => {
    render(<DirectorNote kind="add" text="добавить заметку" hint="не покажется" />);
    expect(screen.queryByText(/не покажется/)).toBeNull();
  });
});

describe('DirectorNote, хром и геометрия', () => {
  it('по умолчанию на светлом хроме', () => {
    const { container } = render(<DirectorNote text="реплика" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className.toLowerCase()).not.toContain('ondark');
  });

  it('onDark передаёт тёмный вариант вниз по атомам', () => {
    const { container } = render(<DirectorNote text="реплика" onDark />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('onDark');
  });

  it('ширина по умолчанию — 300px', () => {
    render(<DirectorNote text="реплика" />);
    const body = screen.getByText('«реплика»').parentElement as HTMLElement;
    expect(body.style.width).toBe('300px');
  });

  it('ширина переопределяется пропом', () => {
    render(<DirectorNote text="реплика" width={220} />);
    const body = screen.getByText('«реплика»').parentElement as HTMLElement;
    expect(body.style.width).toBe('220px');
  });

  it('не рендерит кнопку — заметка сама по себе некликабельна', () => {
    render(<DirectorNote text="реплика" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('корневой узел не фокусируем', () => {
    const { container } = render(<DirectorNote text="реплика" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('tabindex')).toBeNull();
  });
});
