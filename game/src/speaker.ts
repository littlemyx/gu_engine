import { SceneType } from "./types";

export type SceneLine = {
  speaker?: string;
  text: string;
};

export type ParsedScene = {
  /** Ведущая проза-ремарка (описание сцены). Может быть пустой. */
  narration: string;
  /** Реплики персонажей — каждая со своей подписью. */
  lines: SceneLine[];
};

// Подпись реплики: «Имя: текст». Имя — коротко, без внутренней пунктуации
// предложения и не длиннее четырёх слов (иначе это фраза, а не подпись).
const SPEAKER_RE = /^([^:\n]{1,40}):[ \t]*(\S[\s\S]*)$/;

function matchSpeakerLine(rawLine: string): SceneLine | null {
  const line = rawLine.trim();
  if (!line) return null;
  const m = SPEAKER_RE.exec(line);
  if (!m) return null;
  const name = m[1].trim();
  if (!name || /[.!?…]/.test(name) || name.split(/\s+/).length > 4) return null;
  return { speaker: name, text: m[2].trim() };
}

/**
 * Разбирает плоский label сцены на ведущую наррацию и реплики. Реплики
 * сериализуются (convertToGameProject.renderDraftSceneText) хвостовым блоком
 * «Имя: текст» — строки через \n, отделённые от наррации пустой строкой (\n\n).
 * Поэтому диалог — это максимальный хвост строк-подписей, а всё до него —
 * наррация.
 *
 * Для не-dialogue сцен требуем и ведущую наррацию, и пустую строку-разделитель:
 * иначе случайное «Слово: …» в описательной прозе приняли бы за подпись.
 */
export function parseScene(label: string, sceneType: SceneType): ParsedScene {
  const physical = label.replace(/\r\n/g, "\n").split("\n");

  const lines: SceneLine[] = [];
  let start = physical.length;
  for (let i = physical.length - 1; i >= 0; i--) {
    const parsed = matchSpeakerLine(physical[i]);
    if (!parsed) break;
    lines.unshift(parsed);
    start = i;
  }

  const separated = start === 0 || physical[start - 1].trim() === "";
  const requireNarrationPrefix = sceneType !== "dialogue";
  const hasDialogue =
    lines.length > 0 && separated && (!requireNarrationPrefix || start > 0);

  if (!hasDialogue) {
    return { narration: label.trim(), lines: [] };
  }

  return { narration: physical.slice(0, start).join("\n").trim(), lines };
}
