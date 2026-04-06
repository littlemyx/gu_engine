import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import common from '../common.module.css';
import styles from './SettingsPanel.module.css';

export const SettingsPanel = () => {
  const [open, setOpen] = useState(false);
  const { openaiApiKey, setOpenaiApiKey } = useSettingsStore();

  return (
    <div className={common.foldableSection}>
      <button type="button" className={common.foldableHeader} onClick={() => setOpen(v => !v)}>
        <span className={`${common.foldableArrow} ${open ? common.foldableArrowOpen : ''}`}>&#9654;</span>
        Настройки
      </button>
      {open && (
        <div className={styles.content}>
          <label className={styles.label}>
            OpenAI API Key
            <input
              type="password"
              className={styles.input}
              value={openaiApiKey}
              onChange={e => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </label>
        </div>
      )}
    </div>
  );
};
