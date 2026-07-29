/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import InspectorOverlay from './InspectorOverlay';

afterEach(cleanup);

describe('InspectorOverlay', () => {
  it('показывает заголовок', () => {
    render(<InspectorOverlay title="Инспектор · Бит 04" />);
    expect(screen.getByText('Инспектор · Бит 04')).toBeTruthy();
  });

  it('рендерит переданное содержимое', () => {
    render(
      <InspectorOverlay title="Инспектор">
        <span>тело панели</span>
      </InspectorOverlay>,
    );
    expect(screen.getByText('тело панели')).toBeTruthy();
  });

  it('вызывает onClose по клику на кнопку закрытия', () => {
    let closed = 0;
    render(
      <InspectorOverlay
        title="Инспектор"
        onClose={() => {
          closed += 1;
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть (Esc)' }));
    expect(closed).toBe(1);
  });

  it('без onClose кнопки закрытия нет', () => {
    render(<InspectorOverlay title="Инспектор" />);
    expect(screen.queryByRole('button', { name: 'Закрыть (Esc)' })).toBeNull();
  });

  it('ширина и высота по умолчанию — 300×320px', () => {
    const { container } = render(<InspectorOverlay title="Инспектор" />);
    const panel = container.querySelector('[class*="panel"]') as HTMLElement;
    expect(panel.style.width).toBe('300px');
    expect(panel.style.height).toBe('320px');
  });

  it('ширина и высота переопределяются пропами', () => {
    const { container } = render(<InspectorOverlay title="Инспектор" width={360} height={480} />);
    const panel = container.querySelector('[class*="panel"]') as HTMLElement;
    expect(panel.style.width).toBe('360px');
    expect(panel.style.height).toBe('480px');
  });
});
