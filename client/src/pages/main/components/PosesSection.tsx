import { useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteImage } from '@root/image_server/generated-client';
import { usePrototypeStore } from '@/store/prototypeStore';
import { IMAGE_SERVER_BASE } from '../constants';
import type { CharacterPose } from '../types';
import common from '../common.module.css';
import styles from './PosesSection.module.css';

const PoseInput = ({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}) => {
  const [focused, setFocused] = useState(false);

  if (focused) {
    return (
      <textarea
        autoFocus
        className={`nodrag nopan ${styles.poseTextarea}`}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setFocused(false)}
      />
    );
  }

  return (
    <div
      className={`nodrag nopan ${styles.poseCollapsed}`}
      onClick={() => setFocused(true)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter') setFocused(true);
      }}
    >
      {value || <span className={styles.posePlaceholder}>{placeholder}</span>}
    </div>
  );
};

export const PosesSection = ({
  nodeId,
  poses,
  generatedImages,
  onRegeneratePose,
}: {
  nodeId: string;
  poses: CharacterPose[];
  generatedImages?: string[];
  onRegeneratePose?: (poseIndex: number, poseDescription: string) => Promise<void>;
}) => {
  const { addPose, removePose, updatePose } = usePrototypeStore();
  const [open, setOpen] = useState(true);
  const [deletingPoseId, setDeletingPoseId] = useState<string | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ image: string; x: number; y: number } | null>(null);

  const posesList = poses || [];

  const handleDeletePose = (poseId: string, poseIndex: number, poseImage?: string) => {
    if (poseImage) {
      deleteImage({ path: { name: poseImage } }).catch(() => {});
    }
    removePose(nodeId, poseId, poseIndex);
    setDeletingPoseId(null);
  };

  return (
    <div className={styles.posesSection}>
      <button className={`nodrag nopan ${common.foldableHeader}`} onClick={() => setOpen(v => !v)} type="button">
        <span className={`${common.foldableArrow} ${open ? common.foldableArrowOpen : ''}`}>&#9654;</span>
        Позы ({posesList.length})
      </button>
      {open && (
        <div className={styles.posesList}>
          {posesList.map((pose, index) => {
            const poseImage = generatedImages?.[index];
            return (
              <div key={pose.id} className={styles.poseRow}>
                <div className={styles.poseContent}>
                  <PoseInput
                    value={pose.description}
                    placeholder="Описание позы (напр. грустный, боевая стойка)"
                    onChange={val => updatePose(nodeId, pose.id, val)}
                  />
                  <button
                    type="button"
                    className={`nodrag nopan ${common.outputDelete}`}
                    onClick={() => {
                      if (!pose.description && !poseImage) {
                        handleDeletePose(pose.id, index, poseImage);
                      } else {
                        setDeletingPoseId(pose.id);
                      }
                    }}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
                {deletingPoseId === pose.id && (
                  <div className={`nodrag nopan ${common.deleteConfirm}`}>
                    <p>Удалить позу?</p>
                    <div className={common.deleteConfirmActions}>
                      <button
                        type="button"
                        className={common.deleteConfirmCancel}
                        onClick={() => setDeletingPoseId(null)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className={common.deleteConfirmSubmit}
                        onClick={() => handleDeletePose(pose.id, index, poseImage)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
                {poseImage ? (
                  <div
                    className={`${styles.poseThumbnailWrap} ${
                      regeneratingIndex === index ? styles.poseThumbnailRegenerating : ''
                    }`}
                  >
                    <img
                      src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(poseImage)}/thumbnail`}
                      alt={pose.description}
                      className={styles.poseThumbnail}
                      onMouseEnter={e => setHoverPreview({ image: poseImage, x: e.clientX, y: e.clientY })}
                      onMouseMove={e =>
                        setHoverPreview(prev => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
                      }
                      onMouseLeave={() => setHoverPreview(null)}
                    />
                    {onRegeneratePose && (
                      <button
                        type="button"
                        className={`nodrag nopan ${styles.poseRegenBtn} ${
                          regeneratingIndex === index ? styles.poseRegenSpinning : ''
                        }`}
                        title="Перегенерировать"
                        disabled={regeneratingIndex === index}
                        onClick={() => {
                          setRegeneratingIndex(index);
                          onRegeneratePose(index, pose.description).finally(() => setRegeneratingIndex(null));
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M1 8a7 7 0 0 1 12.07-4.83" />
                          <path d="M13.07 0v3.17H9.9" />
                          <path d="M15 8A7 7 0 0 1 2.93 12.83" />
                          <path d="M2.93 16v-3.17H6.1" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  onRegeneratePose && (
                    <button
                      type="button"
                      className={`nodrag nopan ${styles.poseGenerateBtn} ${
                        regeneratingIndex === index ? styles.poseGenerateBtnSpinning : ''
                      }`}
                      title="Сгенерировать позу"
                      disabled={regeneratingIndex === index}
                      onClick={() => {
                        setRegeneratingIndex(index);
                        onRegeneratePose(index, pose.description).finally(() => setRegeneratingIndex(null));
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="none">
                        <path d="M4.5 1l.5 1.5L6.5 3l-1.5.5L4.5 5l-.5-1.5L2.5 3l1.5-.5zM11 4l.7 2.3L14 7l-2.3.7L11 10l-.7-2.3L8 7l2.3-.7zM4.5 10l.5 1.5L6.5 12l-1.5.5-.5 1.5-.5-1.5L2.5 12l1.5-.5z" />
                      </svg>
                    </button>
                  )
                )}
              </div>
            );
          })}
          <button type="button" className={`nodrag nopan ${common.addOutput}`} onClick={() => addPose(nodeId)}>
            + Добавить позу
          </button>
        </div>
      )}
      {hoverPreview &&
        createPortal(
          <div className={styles.posePreview} style={{ left: hoverPreview.x + 16, top: hoverPreview.y + 16 }}>
            <img src={`${IMAGE_SERVER_BASE}/images/${encodeURIComponent(hoverPreview.image)}`} alt="Preview" />
          </div>,
          document.body,
        )}
    </div>
  );
};
