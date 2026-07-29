/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import GalleryFrame, { type GalleryFrameElevation } from './GalleryFrame';

afterEach(cleanup);

describe('GalleryFrame', () => {
  it('показывает кикер и заголовок', () => {
    render(<GalleryFrame kicker="ГАЛЕРЕЯ · dialogue_units / …" title="Проза · diff тейков" />);

    expect(screen.getByText('ГАЛЕРЕЯ · dialogue_units / …')).toBeTruthy();
    expect(screen.getByText('Проза · diff тейков')).toBeTruthy();
  });

  it('без meta приписки нет', () => {
    render(<GalleryFrame kicker="кикер" title="заголовок" />);
    expect(screen.queryByText('14 из 20')).toBeNull();
  });

  it('с meta показывает приписку рядом с заголовком', () => {
    render(<GalleryFrame kicker="кикер" title="заголовок" meta="14 из 20" />);
    expect(screen.getByText('14 из 20')).toBeTruthy();
  });

  it('рендерит произвольное содержимое', () => {
    render(
      <GalleryFrame kicker="кикер" title="заголовок">
        <span>содержимое галереи…</span>
      </GalleryFrame>,
    );
    expect(screen.getByText('содержимое галереи…')).toBeTruthy();
  });

  it('ширина и отступ по умолчанию — 240px и 14px', () => {
    const { container } = render(<GalleryFrame kicker="кикер" title="заголовок" elevation="none" />);
    const cornerDiv = container.firstElementChild as HTMLElement;
    const root = cornerDiv.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('240px');
    expect(root.style.padding).toBe('14px');
  });

  it('ширина и отступ переопределяются пропами', () => {
    const { container } = render(
      <GalleryFrame kicker="кикер" title="заголовок" elevation="none" width={420} padding={20} />,
    );
    const cornerDiv = container.firstElementChild as HTMLElement;
    const root = cornerDiv.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('420px');
    expect(root.style.padding).toBe('20px');
  });

  it('кегль заголовка по умолчанию — 15px, переопределяется пропом', () => {
    render(<GalleryFrame kicker="кикер" title="заголовок" />);
    expect((screen.getByText('заголовок') as HTMLElement).style.fontSize).toBe('15px');

    cleanup();

    render(<GalleryFrame kicker="кикер" title="крупный" titleSize={20} />);
    expect((screen.getByText('крупный') as HTMLElement).style.fontSize).toBe('20px');
  });

  it('elevation "none" не добавляет обёртку тени', () => {
    const { container } = render(<GalleryFrame kicker="кикер" title="заголовок" elevation="none" />);
    const cornerDiv = container.firstElementChild as HTMLElement;
    const root = cornerDiv.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('240px');
  });

  it('elevation по умолчанию ("lg") оборачивает тенью — на уровень вложенности глубже', () => {
    const { container } = render(<GalleryFrame kicker="кикер" title="заголовок" />);
    const shadowDiv = container.firstElementChild as HTMLElement;
    const cornerDiv = shadowDiv.firstElementChild as HTMLElement;
    const root = cornerDiv.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('240px');
  });
});

const ELEVATIONS: GalleryFrameElevation[] = ['none', 'sm', 'md', 'lg'];

describe.each(ELEVATIONS)('GalleryFrame, elevation %s', elevation => {
  it('показывает кикер и заголовок', () => {
    render(<GalleryFrame kicker="кикер" title="заголовок" elevation={elevation} />);
    expect(screen.getByText('кикер')).toBeTruthy();
    expect(screen.getByText('заголовок')).toBeTruthy();
  });
});
