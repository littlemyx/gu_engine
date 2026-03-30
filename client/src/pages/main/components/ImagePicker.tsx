import { useEffect, useState } from 'react';
import { listImages } from '@root/image_server/generated-client';
import type { ImageName } from '@root/image_server/generated-client';
import { IMAGE_SERVER_BASE } from '../constants';
import styles from './ImagePicker.module.css';

export const ImagePicker = ({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) => {
  const [images, setImages] = useState<ImageName[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listImages().then(({ data }) => {
      if (data) setImages(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className={`nodrag nopan nowheel ${styles.imagePicker}`}>
      <div className={styles.imagePickerHeader}>
        <span>Выберите изображение</span>
        <button type="button" className={styles.imagePickerClose} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.imagePickerGrid}>
        {loading && <span className={styles.imageListHint}>Загрузка…</span>}
        {!loading && images.length === 0 && <span className={styles.imageListHint}>Нет изображений</span>}
        {images.map(img => (
          <button
            key={img.name}
            type="button"
            className={styles.imagePickerItem}
            onClick={() => onSelect(`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(img.name)}`)}
            title={img.name}
          >
            <img src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(img.name)}/thumbnail`} alt={img.name} />
          </button>
        ))}
      </div>
    </div>
  );
};
