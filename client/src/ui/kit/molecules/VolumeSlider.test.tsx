/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import VolumeSlider from './VolumeSlider';

afterEach(cleanup);

describe('VolumeSlider', () => {
  it('показывает подпись и переданное значение', () => {
    render(<VolumeSlider label="vol" value={45} />);
    expect(screen.getByText('vol')).toBeTruthy();
    expect(screen.getByText('45')).toBeTruthy();
  });

  it('без значения показывает значение по умолчанию', () => {
    render(<VolumeSlider label="vol" />);
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('зажимает значение в диапазон 0–100', () => {
    render(<VolumeSlider label="vol" value={140} />);
    expect(screen.getByText('100')).toBeTruthy();

    cleanup();

    render(<VolumeSlider label="vol" value={-20} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('стрелками двигает значение и вызывает onChange', () => {
    const handleChange = vi.fn();
    render(<VolumeSlider label="vol" value={45} onChange={handleChange} />);

    const track = screen.getByRole('slider', { name: 'vol' });
    fireEvent.keyDown(track, { key: 'ArrowRight' });

    expect(handleChange).toHaveBeenCalledWith(46);
    expect(screen.getByText('46')).toBeTruthy();
  });

  it('disabled — трек недоступен и не реагирует на клавиши', () => {
    const handleChange = vi.fn();
    render(<VolumeSlider label="vol" value={45} onChange={handleChange} disabled />);

    const track = screen.getByRole('slider', { name: 'vol' });
    expect(track.getAttribute('aria-disabled')).toBe('true');
    expect(track.getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByText('45')).toBeTruthy();
  });

  it('на светлом хроме значение без класса onDark', () => {
    render(<VolumeSlider label="vol" value={45} />);
    expect(screen.getByText('45').className).not.toMatch(/onDark/);
  });

  it('на тёмном хроме значение помечено классом onDark', () => {
    render(<VolumeSlider label="vol" value={45} onDark />);
    expect(screen.getByText('45').className).toMatch(/onDark/);
  });
});
