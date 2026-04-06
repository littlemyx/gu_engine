import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SettingsState = {
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      openaiApiKey: '',
      setOpenaiApiKey: (key: string) => set({ openaiApiKey: key }),
    }),
    {
      name: 'gu-settings',
    },
  ),
);
