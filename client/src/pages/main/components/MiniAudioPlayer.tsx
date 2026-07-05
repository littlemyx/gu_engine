import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './MiniAudioPlayer.module.css';

type Props = {
  src: string;
  label?: string;
};

export const MiniAudioPlayer = ({ src, label }: Props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      // Без cleanup плеер продолжает играть после сворачивания секции
      // или удаления карточки — остановить его уже нечем.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.addEventListener('ended', () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, [src, playing]);

  return (
    <div className={styles.player}>
      <button
        type="button"
        className={`nodrag nopan ${styles.playBtn}`}
        onClick={toggle}
        title={playing ? 'Стоп' : 'Играть'}
      >
        {playing ? '⏹' : '▶'}
      </button>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
};
