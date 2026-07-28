/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DropTargetSlot from './DropTargetSlot';

afterEach(cleanup);

describe('DropTargetSlot', () => {
  it('показывает подпись слота', () => {
    render(<DropTargetSlot label="слот Д6у · свободен — отпустить сюда" />);
    expect(screen.getByText('слот Д6у · свободен — отпустить сюда')).toBeTruthy();
  });

  it('активный слот по умолчанию некликабелен', () => {
    render(<DropTargetSlot label="слот" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('активный слот не фокусируем', () => {
    const { container } = render(<DropTargetSlot label="слот" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('tabindex')).toBeNull();
  });

  it('занятый слот перекрывает активность', () => {
    render(<DropTargetSlot label="слот" busy active />);
    const text = screen.getByText('слот');
    expect(text.className.toLowerCase()).toContain('error');
  });

  it('активный слот подсвечен сигналом info', () => {
    render(<DropTargetSlot label="слот" active />);
    const text = screen.getByText('слот');
    expect(text.className.toLowerCase()).toContain('info');
  });

  it('неактивный свободный слот рендерит нейтральный текст без AccentText', () => {
    render(<DropTargetSlot label="слот" active={false} />);
    const text = screen.getByText('слот');
    expect(text.className.toLowerCase()).not.toContain('info');
    expect(text.className.toLowerCase()).not.toContain('error');
  });

  it('по умолчанию рендерит на светлом хроме', () => {
    render(<DropTargetSlot label="слот" active={false} />);
    const text = screen.getByText('слот');
    expect(text.className.toLowerCase()).not.toContain('ondark');
  });

  it('на тёмном хроме передаёт onDark вниз по атомам', () => {
    render(<DropTargetSlot label="слот" active={false} onDark />);
    const text = screen.getByText('слот');
    expect(text.className.toLowerCase()).toContain('ondark');
  });

  it('без ширины растягивается на 100%', () => {
    render(<DropTargetSlot label="слот" />);
    const wrap = screen.getByText('слот').parentElement as HTMLElement;
    expect(wrap.style.width).toBe('100%');
  });

  it('ширина переопределяется пропом', () => {
    render(<DropTargetSlot label="слот" width={220} />);
    const wrap = screen.getByText('слот').parentElement as HTMLElement;
    expect(wrap.style.width).toBe('220px');
  });
});
