/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import RunOverlayCard, { type RunOverlayPhaseItem } from './RunOverlayCard';

afterEach(cleanup);

const PHASES: RunOverlayPhaseItem[] = [
  { label: 'фазы 1–7', value: '$0.13', status: 'done' },
  { label: 'Диалоговые юниты', value: '14/24', status: 'current' },
  { label: 'Эпилоги', value: '≈ $0.06', status: 'waiting' },
  { label: 'Story QA', value: '≈ $0.03', status: 'waiting' },
];

describe('RunOverlayCard', () => {
  it('показывает заголовок и все фазы с их значениями', () => {
    render(<RunOverlayCard title="Прогон · фаза 8/10" phases={PHASES} percent={58} />);

    expect(screen.getByText('Прогон · фаза 8/10')).toBeTruthy();
    PHASES.forEach(phase => {
      expect(screen.getByText(phase.label)).toBeTruthy();
      expect(screen.getByText(phase.value)).toBeTruthy();
    });
  });

  it('готовую фазу помечает глифом ✓, текущую — ⟳', () => {
    render(<RunOverlayCard title="Прогон" phases={PHASES} percent={58} />);

    expect(screen.getByRole('img', { name: 'ok' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'run' })).toBeTruthy();
  });

  it('ожидающую фазу помечает литералом «·», а не StatusGlyph', () => {
    render(<RunOverlayCard title="Прогон" phases={PHASES} percent={58} />);

    const waitingGlyphs = screen.getAllByText('·');
    expect(waitingGlyphs.length).toBe(2);
    expect(screen.queryByRole('img', { name: 'none' })).toBeNull();
  });

  it('ширина карточки по умолчанию 240px, переопределяется пропом', () => {
    const { container: defaultContainer } = render(<RunOverlayCard title="Прогон" phases={PHASES} percent={58} />);
    const defaultRoot = defaultContainer.querySelector('[style]') as HTMLElement;
    expect(defaultRoot.style.width).toBe('240px');
    cleanup();

    const { container } = render(<RunOverlayCard title="Прогон" phases={PHASES} percent={58} width={320} />);
    const root = container.querySelector('[style]') as HTMLElement;
    expect(root.style.width).toBe('320px');
  });

  it('полоса прогресса отражает percent как aria-valuenow', () => {
    render(<RunOverlayCard title="Прогон" phases={PHASES} percent={72} />);

    const track = screen.getByRole('progressbar');
    expect(track.getAttribute('aria-valuenow')).toBe('72');
  });

  it('без фаз рисует только заголовок и полосу прогресса', () => {
    render(<RunOverlayCard title="Прогон" phases={[]} percent={10} />);

    expect(screen.getByText('Прогон')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
