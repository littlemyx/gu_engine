/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ModalFrame from './ModalFrame';

afterEach(cleanup);

describe('ModalFrame', () => {
  it('показывает кикер и заголовок', () => {
    render(<ModalFrame kicker="ПРОГОН #13" title="Колл-щит" />);

    expect(screen.getByText('ПРОГОН #13')).toBeTruthy();
    expect(screen.getByText('Колл-щит')).toBeTruthy();
  });

  it('без subtitle приписки нет', () => {
    render(<ModalFrame kicker="ПРОГОН #13" title="Колл-щит" />);
    expect(screen.queryByText('черновик')).toBeNull();
  });

  it('с subtitle показывает приписку рядом с заголовком', () => {
    render(<ModalFrame kicker="ПРОГОН #13" title="Колл-щит" subtitle="черновик" />);
    expect(screen.getByText('черновик')).toBeTruthy();
  });

  it('рендерит содержимое', () => {
    render(
      <ModalFrame kicker="ПРОГОН #13" title="Колл-щит">
        <span>тело модала</span>
      </ModalFrame>,
    );
    expect(screen.getByText('тело модала')).toBeTruthy();
  });

  it('ширина по умолчанию — 240px', () => {
    render(<ModalFrame kicker="ПРОГОН #13" title="Колл-щит" />);
    const dialog = screen.getByRole('dialog') as HTMLElement;
    expect(dialog.style.width).toBe('240px');
  });

  it('ширина переопределяется пропом', () => {
    render(<ModalFrame kicker="ПРОГОН #13" title="Колл-щит" width={360} />);
    const dialog = screen.getByRole('dialog') as HTMLElement;
    expect(dialog.style.width).toBe('360px');
  });

  it('несёт роль dialog', () => {
    render(<ModalFrame kicker="ПРОГОН #13" title="Колл-щит" />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
