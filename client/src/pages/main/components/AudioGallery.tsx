import { useCallback, useEffect, useState } from 'react';
import { listAudio } from '@root/audio_server/generated-client';
import type { AudioFile } from '@root/audio_server/generated-client';
import { AUDIO_SERVER_BASE } from '../constants';
import { MiniAudioPlayer } from './MiniAudioPlayer';
import common from '../common.module.css';
import styles from './AudioGallery.module.css';

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export const AudioGallery = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchAudio = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAudio();
      if (data) setAudioFiles(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchAudio();
  }, [fetchAudio, open]);

  return (
    <div className={common.foldableSection}>
      <button className={common.foldableHeader} onClick={() => setOpen(v => !v)} type="button">
        <span className={`${common.foldableArrow} ${open ? common.foldableArrowOpen : ''}`}>&#9654;</span>
        Аудио
        <span
          className={styles.refreshBtn}
          role="button"
          tabIndex={0}
          title="Обновить список"
          onClick={e => {
            e.stopPropagation();
            fetchAudio();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              fetchAudio();
            }
          }}
        >
          ⟳
        </span>
      </button>
      {open && (
        <div className={styles.audioList}>
          {loading && <span className={styles.audioListHint}>Загрузка…</span>}
          {!loading && audioFiles.length === 0 && <span className={styles.audioListHint}>Нет аудио</span>}
          {audioFiles.map(file => (
            <div key={file.name} className={styles.audioItem} title={file.name}>
              <MiniAudioPlayer src={`${AUDIO_SERVER_BASE}/audio/${encodeURIComponent(file.name)}`} />
              <span className={styles.audioName}>{file.name}</span>
              <span className={styles.audioDuration}>{formatDuration(file.durationMs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
