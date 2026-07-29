/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import InplacePreview from './InplacePreview';

afterEach(cleanup);

describe('InplacePreview', () => {
  it('показывает подпись и пояснение', () => {
    render(<InplacePreview caption="пирс, вечер · ▣ из префаба «Взморье» v1" note="строка развёрнута по ▸" />);
    expect(screen.getByText('пирс, вечер · ▣ из префаба «Взморье» v1')).toBeTruthy();
    expect(screen.getByText('строка развёрнута по ▸')).toBeTruthy();
  });

  it('по умолчанию берёт размер макета 236×66', () => {
    const { container } = render(<InplacePreview caption="кафе" note="пояснение" />);
    const frame = container.querySelector('div[style]') as HTMLDivElement;
    expect(frame.style.width).toBe('236px');
    expect(frame.style.height).toBe('66px');
  });

  it('thumbWidth/thumbHeight переопределяют размер плашки', () => {
    const { container } = render(<InplacePreview caption="кафе" note="пояснение" thumbWidth={120} thumbHeight={40} />);
    const frame = container.querySelector('div[style]') as HTMLDivElement;
    expect(frame.style.width).toBe('120px');
    expect(frame.style.height).toBe('40px');
  });

  it('не рисует кликабельных элементов — превью не интерактивно', () => {
    render(<InplacePreview caption="кафе" note="пояснение" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('без onDark и с onDark одинаково показывает текст (не рвётся с флагом)', () => {
    render(<InplacePreview caption="кафе" note="пояснение" onDark />);
    expect(screen.getByText('пояснение')).toBeTruthy();
  });
});
