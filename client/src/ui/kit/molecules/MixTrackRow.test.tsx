/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import MixTrackRow, { type MixTrackRowWave } from './MixTrackRow';

afterEach(cleanup);

describe('MixTrackRow, содержимое', () => {
  it('показывает кикер, имя дорожки и тейк', () => {
    render(<MixTrackRow kicker="МУЗЫКА" track="audio_pier_evening" take="тейк A · принят · $0.12" />);

    expect(screen.getByText('МУЗЫКА')).toBeTruthy();
    expect(screen.getByText('audio_pier_evening')).toBeTruthy();
    expect(screen.getByText('тейк A · принят · $0.12')).toBeTruthy();
  });
});

const WAVES: MixTrackRowWave[] = ['active', 'muted'];

describe.each(WAVES)('MixTrackRow, волна %s', wave => {
  it('рендерит волну без падения', () => {
    const { container } = render(<MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" wave={wave} />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('MixTrackRow, свой контент вместо волны', () => {
  it('children заменяет Waveform', () => {
    render(
      <MixTrackRow kicker="SFX" track="clip.wav" take="тейк B">
        <span data-testid="custom-clip">клип</span>
      </MixTrackRow>,
    );

    expect(screen.getByTestId('custom-clip')).toBeTruthy();
  });
});

describe('MixTrackRow, заметка над волной', () => {
  it('без note заметки нет', () => {
    render(<MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" />);
    expect(screen.queryByText('0:42')).toBeNull();
  });

  it('note слева по умолчанию', () => {
    render(<MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" note="0:42" />);
    expect(screen.getByText('0:42')).toBeTruthy();
  });

  it('noteSide=right принимается', () => {
    render(<MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" note="0:42" noteSide="right" />);
    expect(screen.getByText('0:42')).toBeTruthy();
  });
});

describe('MixTrackRow, активность', () => {
  it('active=true и active=false рендерят строку без падения', () => {
    const { container: activeContainer } = render(
      <MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" active />,
    );
    expect(activeContainer.firstElementChild).toBeTruthy();
    cleanup();

    const { container: inactiveContainer } = render(
      <MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" active={false} />,
    );
    expect(inactiveContainer.firstElementChild).toBeTruthy();
  });
});

describe('MixTrackRow, громкость', () => {
  it('слайдер получает значение и aria-label', () => {
    render(<MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" volume={62} />);

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('62');
    expect(slider.getAttribute('aria-label')).toBe('громкость');
  });

  it('стрелка на слайдере вызывает onVolumeChange', () => {
    let received: number | null = null;
    render(
      <MixTrackRow
        kicker="МУЗЫКА"
        track="track.wav"
        take="тейк A"
        volume={50}
        onVolumeChange={value => {
          received = value;
        }}
      />,
    );

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(received).toBe(51);
  });
});

describe('MixTrackRow, FX-фишки', () => {
  it('рендерит переданные теги и кнопку добавления', () => {
    render(
      <MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" fx={['reverb 18%', 'lowpass 4k']} fxAddLabel="FX" />,
    );

    expect(screen.getByText('reverb 18%')).toBeTruthy();
    expect(screen.getByText('lowpass 4k')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ FX' })).toBeTruthy();
  });

  it('клик по кнопке добавления вызывает onFxAdd', () => {
    let clicks = 0;
    render(
      <MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" fxAddLabel="FX" onFxAdd={() => (clicks += 1)} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ FX' }));
    expect(clicks).toBe(1);
  });
});

describe('MixTrackRow, клик по инфо-колонке', () => {
  it('без onClick инфо-колонка не является кнопкой', () => {
    render(<MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" />);
    expect(screen.queryByRole('button', { name: /audio_pier_evening|track\.wav/ })).toBeNull();
  });

  it('с onClick инфо-колонка — кнопка, клик вызывает колбэк', () => {
    let clicks = 0;
    render(<MixTrackRow kicker="МУЗЫКА" track="track.wav" take="тейк A" onClick={() => (clicks += 1)} />);

    const button = screen.getByRole('button', { name: /track\.wav/ });
    fireEvent.click(button);
    expect(clicks).toBe(1);
  });
});
