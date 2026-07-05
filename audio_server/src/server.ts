import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import cors from "cors";
import { parseBuffer } from "music-metadata";

type NameParams = { name: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3008;

const AUDIO_DIR = path.join(__dirname, "..", "audio");
const DURATIONS_PATH = path.join(AUDIO_DIR, "durations.json");

// Расширение выводится из mime, а не из имени клиента: имя файла нельзя
// пускать в расширение — залитый как audio/* .html отдавался бы браузеру
// как text/html (stored XSS на этом origin-е).
const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/wave": ".wav",
  "audio/x-wav": ".wav",
};

const storage = multer.diskStorage({
  destination: AUDIO_DIR,
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] ?? ".mp3";
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files (mp3/wav) are allowed"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

// ── Кэш длительностей ───────────────────────────────────────────────────────
// Длительность считается один раз при аплоаде; листинг не читает файлы.

let durationsCache: Record<string, number> | null = null;

async function loadDurations(): Promise<Record<string, number>> {
  if (durationsCache) return durationsCache;
  try {
    durationsCache = JSON.parse(await fs.readFile(DURATIONS_PATH, "utf-8"));
  } catch {
    durationsCache = {};
  }
  return durationsCache!;
}

async function saveDurations(): Promise<void> {
  if (!durationsCache) return;
  await fs.writeFile(DURATIONS_PATH, JSON.stringify(durationsCache), "utf-8");
}

// Полное чтение файла терпимо: с кэшем durations.json оно происходит
// один раз при аплоаде, листинг файлы не читает.
async function getAudioDurationMs(filePath: string): Promise<number> {
  try {
    const buffer = await fs.readFile(filePath);
    const metadata = await parseBuffer(buffer);
    return Math.round((metadata.format.duration ?? 0) * 1000);
  } catch {
    return 0;
  }
}

async function durationFor(name: string, filePath: string): Promise<number> {
  const durations = await loadDurations();
  if (durations[name] !== undefined) return durations[name];
  const ms = await getAudioDurationMs(filePath);
  durations[name] = ms;
  await saveDurations();
  return ms;
}

// ── Роуты ───────────────────────────────────────────────────────────────────

app.post("/audio", upload.single("audio"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }
  const durationMs = await getAudioDurationMs(req.file.path);
  const durations = await loadDurations();
  durations[req.file.filename] = durationMs;
  await saveDurations();
  res.status(201).json({ name: req.file.filename, durationMs });
});

app.get("/audio", async (_req: Request, res: Response) => {
  try {
    const files = await fs.readdir(AUDIO_DIR);
    const audioFiles: { name: string; durationMs: number }[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (ext !== ".mp3" && ext !== ".wav") continue;

      const filePath = path.join(AUDIO_DIR, file);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;

      audioFiles.push({ name: file, durationMs: await durationFor(file, filePath) });
    }

    res.json(audioFiles);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/audio/:name", async (req: Request<NameParams>, res: Response) => {
  const filePath = path.join(AUDIO_DIR, path.basename(req.params.name));
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: "Audio not found" });
  }
});

app.delete("/audio/:name", async (req: Request<NameParams>, res: Response) => {
  const name = path.basename(req.params.name);
  const filePath = path.join(AUDIO_DIR, name);
  try {
    await fs.unlink(filePath);
    const durations = await loadDurations();
    delete durations[name];
    await saveDurations();
    res.json({ deleted: req.params.name });
  } catch {
    res.status(404).json({ error: "Audio not found" });
  }
});

app.patch("/audio/:name", async (req: Request<NameParams>, res: Response) => {
  const oldName = path.basename(req.params.name);
  const oldPath = path.join(AUDIO_DIR, oldName);

  try {
    await fs.access(oldPath);
  } catch {
    res.status(404).json({ error: "Audio not found" });
    return;
  }

  if (req.body.newName) {
    const newName = path.basename(req.body.newName);
    const newPath = path.join(AUDIO_DIR, newName);

    try {
      await fs.access(newPath);
      res.status(409).json({ error: "A file with that name already exists" });
      return;
    } catch {
      // target doesn't exist, good
    }

    await fs.rename(oldPath, newPath);
    const durations = await loadDurations();
    if (durations[oldName] !== undefined) {
      durations[newName] = durations[oldName];
      delete durations[oldName];
      await saveDurations();
    }
    res.json({ name: newName });
    return;
  }

  res.status(400).json({ error: "Provide newName in request body" });
});

// Multer-ошибки (фильтр mime, лимит размера) без обработчика превращались
// в HTML-страницу 500 от Express — отдаём 400 JSON по Error-схеме openapi.
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(400).json({ error: err.message || "Bad request" });
});

async function main(): Promise<void> {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  app.listen(PORT, () => {
    console.log(`Audio server running on http://localhost:${PORT}`);
  });
}

main();
