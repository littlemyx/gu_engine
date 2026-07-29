/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SpriteStage, { type SpriteStageSpeaking } from './SpriteStage';

afterEach(cleanup);

describe('SpriteStage, содержимое', () => {
  it('показывает подписи обоих спрайтов по умолчанию', () => {
    render(<SpriteStage />);
    expect(screen.getByText('left · asel_idle')).toBeTruthy();
    expect(screen.getByText('right · mia_soft · говорит')).toBeTruthy();
  });

  it('подписи приходят пропсами', () => {
    render(<SpriteStage leftLabel="left · kira_idle" rightLabel="right · mia_angry" />);
    expect(screen.getByText('left · kira_idle')).toBeTruthy();
    expect(screen.getByText('right · mia_angry')).toBeTruthy();
  });

  it('рисует ровно два глифа-полукруга', () => {
    render(<SpriteStage />);
    expect(screen.getAllByText('◐')).toHaveLength(2);
  });
});

describe('SpriteStage, ширина', () => {
  it('по умолчанию 400px', () => {
    const { container } = render(<SpriteStage />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('400px');
  });

  it('переопределяется пропом width', () => {
    const { container } = render(<SpriteStage width={600} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('600px');
  });
});

describe('SpriteStage, кто говорит', () => {
  it('по умолчанию справа: правый глиф крупнее левого', () => {
    render(<SpriteStage width={400} />);
    const [left, right] = screen.getAllByText('◐') as HTMLElement[];
    expect(right.style.fontSize).toBe('74px');
    expect(left.style.fontSize).toBe('64px');
  });

  it('speaking="слева": левый глиф крупнее правого', () => {
    render(<SpriteStage width={400} speaking="слева" />);
    const [left, right] = screen.getAllByText('◐') as HTMLElement[];
    expect(left.style.fontSize).toBe('74px');
    expect(right.style.fontSize).toBe('64px');
  });

  it('speaking="никто": оба глифа одного размера', () => {
    render(<SpriteStage width={400} speaking="никто" />);
    const [left, right] = screen.getAllByText('◐') as HTMLElement[];
    expect(left.style.fontSize).toBe(right.style.fontSize);
    expect(left.style.fontSize).toBe('64px');
  });

  const SPEAKERS: SpriteStageSpeaking[] = ['слева', 'справа', 'никто'];

  it.each(SPEAKERS)('speaking=%s: говорящая подпись получает отдельный класс от немой', speaking => {
    render(<SpriteStage speaking={speaking} />);
    const leftLabel = screen.getByText('left · asel_idle');
    const rightLabel = screen.getByText('right · mia_soft · говорит');

    if (speaking === 'никто') {
      expect(leftLabel.className).toBe(rightLabel.className);
    } else {
      expect(leftLabel.className).not.toBe(rightLabel.className);
    }
  });
});
