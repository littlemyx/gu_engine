import { useCallback, useEffect, useState } from 'react';
import { listImages } from '@root/image_server/generated-client';
import type { ImageName } from '@root/image_server/generated-client';
import { IMAGE_SERVER_BASE } from '../constants';
import common from '../common.module.css';
import styles from './ImageGallery.module.css';

export const ImageGallery = () => {
  const [images, setImages] = useState<ImageName[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listImages();
      if (data) setImages(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return (
    <div className={common.foldableSection}>
      <button className={common.foldableHeader} onClick={() => setOpen(v => !v)} type="button">
        <span className={`${common.foldableArrow} ${open ? common.foldableArrowOpen : ''}`}>&#9654;</span>
        Изображения
      </button>
      {open && (
        <div className={styles.imageList}>
          {loading && <span className={styles.imageListHint}>Загрузка…</span>}
          {!loading && images.length === 0 && <span className={styles.imageListHint}>Нет изображений</span>}
          {images.map(img => (
            <div key={img.name} className={styles.imageItem} title={img.name}>
              <img
                src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(img.name)}/thumbnail`}
                alt={img.name}
                className={styles.imageThumb}
              />
              <span className={styles.imageName}>{img.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
