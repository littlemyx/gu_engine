/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MapNode, { type MapNodeState } from './MapNode';

afterEach(cleanup);

describe('MapNode, содержимое', () => {
  it('показывает имя и строку метаданных', () => {
    render(<MapNode name="Кафе «Прибой»" meta="♪ уютный · фон ✓ · сцен 12" />);
    expect(screen.getByText('Кафе «Прибой»')).toBeTruthy();
    expect(screen.getByText('♪ уютный · фон ✓ · сцен 12')).toBeTruthy();
  });

  it('ширина по умолчанию 150px, применяется к корню', () => {
    const { container } = render(<MapNode name="Кафе «Прибой»" meta="сцен 12" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('150px');
  });

  it('произвольная ширина применяется к корню', () => {
    const { container } = render(<MapNode name="Кафе «Прибой»" meta="сцен 12" width={220} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('220px');
  });
});

describe('MapNode, кликабельность', () => {
  it('без onClick рендерится нейтральным элементом, а не кнопкой', () => {
    render(<MapNode name="Кафе «Прибой»" meta="сцен 12" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерится кнопкой и вызывает колбэк по клику', () => {
    const onClick = vi.fn();
    render(<MapNode name="Кафе «Прибой»" meta="сцен 12" onClick={onClick} />);
    const button = screen.getByRole('button', { name: /Кафе «Прибой»/ }) as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

const STATES: MapNodeState[] = ['default', 'selected', 'queued', 'error'];

describe.each(STATES)('MapNode, состояние %s', state => {
  it('рендерится без ошибок и показывает метаданные', () => {
    render(<MapNode name="Кафе «Прибой»" meta="сцен 12" state={state} />);
    expect(screen.getByText('сцен 12')).toBeTruthy();
  });

  it('состояние меняет класс корня', () => {
    const { container: base } = render(<MapNode name="К" meta="М" state="default" />);
    const baseClass = base.firstElementChild?.className ?? '';
    cleanup();

    const { container: other } = render(<MapNode name="К" meta="М" state={state} />);
    if (state !== 'default') {
      expect(other.firstElementChild?.className).not.toBe(baseClass);
    }
  });
});

describe('MapNode, акцент метаданных', () => {
  it('очередь и сбой выделяют строку метаданных жирным', () => {
    render(<MapNode name="К" meta="в очереди" state="queued" />);
    const queuedMeta = screen.getByText('в очереди');
    cleanup();

    render(<MapNode name="К" meta="обычная" state="default" />);
    const normalMeta = screen.getByText('обычная');

    expect(queuedMeta.className).not.toBe(normalMeta.className);
  });
});
