import type { GalleryModule } from './galleryTypes';

/**
 * Галерея кита собирается автоматически из файлов `<Name>.gallery.tsx`, лежащих
 * рядом с компонентами. Так параллельные задачи по портированию не делят общего
 * файла-реестра: новый компонент попадает в галерею самим фактом появления.
 *
 * Vite 3 не понимает алиасы в import.meta.glob, поэтому глоб относительный —
 * и, значит, сборщик обязан жить внутри каталога кита.
 */
const modules = import.meta.glob<GalleryModule>('./**/*.gallery.tsx', { eager: true });

export interface GallerySection extends GalleryModule {
  /** `atoms` | `molecules` — по каталогу, в котором лежит компонент. */
  tier: string;
}

function tierOf(path: string): string {
  const [, tier] = path.split('/');
  return tier ?? 'misc';
}

export function collectGallery(): GallerySection[] {
  return Object.entries(modules)
    .map(([path, mod]) => ({ tier: tierOf(path), title: mod.title, cases: mod.cases }))
    .sort((a, b) => a.tier.localeCompare(b.tier) || a.title.localeCompare(b.title));
}
