/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ModalCard from './ModalCard';

afterEach(cleanup);

describe('ModalCard', () => {
  it('показывает заголовок', () => {
    render(<ModalCard title="Режиссура · веса селектора" />);
    expect(screen.getByText('Режиссура · веса селектора')).toBeTruthy();
  });

  it('рендерит содержимое тела', () => {
    render(
      <ModalCard title="Заголовок">
        <span>содержимое модала…</span>
      </ModalCard>,
    );
    expect(screen.getByText('содержимое модала…')).toBeTruthy();
  });

  it('closable по умолчанию — крестик виден', () => {
    render(<ModalCard title="Заголовок" onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeTruthy();
  });

  it('closable=false — крестика нет', () => {
    render(<ModalCard title="Заголовок" closable={false} onClose={() => {}} />);
    expect(screen.queryByLabelText('Закрыть')).toBeNull();
  });

  it('клик по крестику вызывает onClose', () => {
    const onClose = vi.fn();
    render(<ModalCard title="Заголовок" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('без onClose крестик не кликабелен', () => {
    render(<ModalCard title="Заголовок" />);
    expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull();
    expect(screen.getByLabelText('Закрыть')).toBeTruthy();
  });

  it('elevation по умолчанию включена (тень)', () => {
    const { container } = render(<ModalCard title="Заголовок" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/elevated/);
  });

  it('elevation=false — без класса тени', () => {
    const { container } = render(<ModalCard title="Заголовок" elevation={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/elevated/);
  });

  it('ширина по умолчанию — 430px', () => {
    const { container } = render(<ModalCard title="Заголовок" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('430px');
  });

  it('ширина переопределяется пропом', () => {
    const { container } = render(<ModalCard title="Заголовок" width={600} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('600px');
  });
});
