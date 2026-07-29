import React from 'react';

import MixTrackRow from './MixTrackRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MixTrackRow';

export const cases: GalleryCase[] = [
  {
    title: 'активная · волна двойная',
    node: (
      <MixTrackRow
        kicker="МУЗЫКА"
        track="audio_pier_evening"
        take="тейк A · принят · $0.12"
        wave="active"
        playhead={34}
        active
        fx={['reverb 18%', 'lowpass 4k']}
      />
    ),
  },
  {
    title: 'неактивная · волна узкая',
    node: (
      <MixTrackRow
        kicker="МУЗЫКА"
        track="audio_pier_dawn"
        take="тейк B · черновик"
        wave="muted"
        playhead={62}
        active={false}
        fx={['reverb 6%']}
      />
    ),
  },
  {
    title: 'заметка слева',
    node: (
      <MixTrackRow
        kicker="ГОЛОС"
        track="vo_hero_line_04"
        take="тейк C · черновик"
        note="0:42"
        noteSide="left"
        playhead={18}
      />
    ),
  },
  {
    title: 'заметка справа',
    node: (
      <MixTrackRow
        kicker="ГОЛОС"
        track="vo_hero_line_04"
        take="тейк C · черновик"
        note="ждёт синхронизации"
        noteSide="right"
        playhead={80}
      />
    ),
  },
  {
    title: 'без FX-тегов · только кнопка добавить',
    node: <MixTrackRow kicker="SFX" track="sfx_door_creak" take="тейк A · принят" fx={[]} fxAddLabel="FX" />,
  },
  {
    title: 'свой контент вместо волны (children)',
    node: (
      <MixTrackRow kicker="SFX" track="sfx_footsteps_loop" take="тейк A · принят" playhead={50}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '1px dashed var(--gu-line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            color: 'var(--gu-muted)',
          }}
        >
          клип SFX
        </div>
      </MixTrackRow>
    ),
  },
  {
    title: 'кликабельная инфо-колонка',
    node: (
      <MixTrackRow
        kicker="МУЗЫКА"
        track="audio_pier_evening"
        take="тейк A · принят · $0.12"
        onClick={() => {}}
        onFxAdd={() => {}}
      />
    ),
  },
];
