/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DashedFrame, { type DashedFrameKind } from './DashedFrame';

afterEach(cleanup);

const KINDS: DashedFrameKind[] = ['add', 'note', 'missing'];

describe.each(KINDS)('DashedFrame, вид %s', kind => {
  it('оборачивает содержимое и получает свой класс вида', () => {
    render(
      <DashedFrame kind={kind}>
        <span>содержимое</span>
      </DashedFrame>,
    );

    const content = screen.getByText('содержимое');
    const root = content.parentElement as HTMLElement;
    expect(root.className).toContain(kind);
  });

  it('на тёмном получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(
      <DashedFrame kind={kind}>
        <span>содержимое</span>
      </DashedFrame>,
    );
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    render(
      <DashedFrame kind={kind} onDark>
        <span>содержимое</span>
      </DashedFrame>,
    );
    const root = screen.getByText('содержимое').parentElement as HTMLElement;
    expect(root.className).not.toBe(lightClass);
  });
});

describe('DashedFrame, интерактивность', () => {
  it('add по умолчанию фокусируема', () => {
    render(
      <DashedFrame kind="add">
        <span>добавить</span>
      </DashedFrame>,
    );

    const root = screen.getByText('добавить').parentElement as HTMLElement;
    expect(root.tabIndex).toBe(0);
  });

  it('note и missing по умолчанию не фокусируемы', () => {
    render(
      <DashedFrame kind="note">
        <span>заметка</span>
      </DashedFrame>,
    );
    const noteRoot = screen.getByText('заметка').parentElement as HTMLElement;
    expect(noteRoot.getAttribute('tabindex')).toBeNull();
    cleanup();

    render(
      <DashedFrame kind="missing">
        <span>нет данных</span>
      </DashedFrame>,
    );
    const missingRoot = screen.getByText('нет данных').parentElement as HTMLElement;
    expect(missingRoot.getAttribute('tabindex')).toBeNull();
  });

  it('interactive переопределяет умолчание в обе стороны', () => {
    render(
      <DashedFrame kind="add" interactive={false}>
        <span>без фокуса</span>
      </DashedFrame>,
    );
    const offRoot = screen.getByText('без фокуса').parentElement as HTMLElement;
    expect(offRoot.getAttribute('tabindex')).toBeNull();
    expect(offRoot.className).not.toContain('interactive');
    cleanup();

    render(
      <DashedFrame kind="note" interactive>
        <span>с фокусом</span>
      </DashedFrame>,
    );
    const onRoot = screen.getByText('с фокусом').parentElement as HTMLElement;
    expect(onRoot.tabIndex).toBe(0);
    expect(onRoot.className).toContain('interactive');
  });

  it('padding по умолчанию — 12px', () => {
    render(
      <DashedFrame>
        <span>дефолтный отступ</span>
      </DashedFrame>,
    );

    const root = screen.getByText('дефолтный отступ').parentElement as HTMLElement;
    expect(root.style.padding).toBe('12px');
  });

  it('padding переопределяется пропом', () => {
    render(
      <DashedFrame padding={20}>
        <span>отступ</span>
      </DashedFrame>,
    );

    const root = screen.getByText('отступ').parentElement as HTMLElement;
    expect(root.style.padding).toBe('20px');
  });

  it('не рендерит кнопку — рамка сама по себе некликабельна', () => {
    render(
      <DashedFrame>
        <span>содержимое</span>
      </DashedFrame>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});
