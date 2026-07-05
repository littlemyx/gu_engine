import { SceneType } from "./types";

export type ParsedLine = {
  speaker?: string;
  text: string;
};

/**
 * Эвристика имени говорящего для dialogue-сцен. Реплики хранятся в label как
 * «Имя: текст». Если первая строка похожа на такую подпись — выносим имя в
 * отдельный блок. Иначе отдаём label как есть (narration, описания и т.п.).
 */
export function parseSpeaker(label: string, sceneType: SceneType): ParsedLine {
  if (sceneType !== "dialogue") return { text: label };

  const m = /^([^:\n]{1,40}):[ \t]*([\s\S]+)$/.exec(label);
  if (!m) return { text: label };

  const name = m[1].trim();
  // Отсекаем очевидно-не-имена: предложение с пунктуацией внутри «имени»
  // или больше четырёх слов (это уже фраза, а не подпись).
  if (/[.!?…]/.test(name) || name.split(/\s+/).length > 4) {
    return { text: label };
  }

  return { speaker: name, text: m[2].trim() };
}
