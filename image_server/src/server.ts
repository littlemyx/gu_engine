import express, { type Request, type Response } from "express";

type NameParams = { name: string };
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3007;

const IMAGES_DIR = path.join(__dirname, "..", "images");
const THUMBNAIL_WIDTH = 120;
const THUMBNAIL_HEIGHT = 80;

// Ensure images directory exists
fs.mkdir(IMAGES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

// POST /images — upload an image
app.post("/images", upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No image provided" });
    return;
  }
  res.status(201).json({ name: req.file.filename });
});

// GET /images — list all image names
app.get("/images", async (_req: Request, res: Response) => {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const images: { name: string }[] = [];

    for (const file of files) {
      const filePath = path.join(IMAGES_DIR, file);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;

      try {
        await sharp(filePath).metadata();
        images.push({ name: file });
      } catch {
        // skip non-image files
      }
    }

    res.json(images);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /images/:name — return full image
app.get("/images/:name", async (req: Request<NameParams>, res: Response) => {
  const filePath = path.join(IMAGES_DIR, path.basename(req.params.name));
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: "Image not found" });
  }
});

// GET /images/:name/thumbnail — return resized thumbnail
app.get("/images/:name/thumbnail", async (req: Request<NameParams>, res: Response) => {
  const filePath = path.join(IMAGES_DIR, path.basename(req.params.name));
  try {
    await fs.access(filePath);
    const thumbnail = await sharp(filePath)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    res.set("Content-Type", "image/jpeg");
    res.send(thumbnail);
  } catch {
    res.status(404).json({ error: "Image not found" });
  }
});

// DELETE /images/:name — delete an image
app.delete("/images/:name", async (req: Request<NameParams>, res: Response) => {
  const filePath = path.join(IMAGES_DIR, path.basename(req.params.name));
  try {
    await fs.unlink(filePath);
    res.json({ deleted: req.params.name });
  } catch {
    res.status(404).json({ error: "Image not found" });
  }
});

// PATCH /images/:name — rename image or replace file
app.patch(
  "/images/:name",
  upload.single("image"),
  async (req: Request<NameParams>, res: Response) => {
    const oldName = path.basename(req.params.name);
    const oldPath = path.join(IMAGES_DIR, oldName);

    try {
      await fs.access(oldPath);
    } catch {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(404).json({ error: "Image not found" });
      return;
    }

    // Replace file under same name
    if (req.file) {
      await fs.unlink(oldPath);
      await fs.rename(req.file.path, oldPath);
      res.json({ name: oldName });
      return;
    }

    // Rename
    if (req.body.newName) {
      const newName = path.basename(req.body.newName);
      const newPath = path.join(IMAGES_DIR, newName);

      try {
        await fs.access(newPath);
        res
          .status(409)
          .json({ error: "A file with that name already exists" });
        return;
      } catch {
        // target doesn't exist, good
      }

      await fs.rename(oldPath, newPath);
      res.json({ name: newName });
      return;
    }

    res.status(400).json({ error: "Provide newName or a new image file" });
  }
);

app.listen(PORT, () => {
  console.log(`Image server running on http://localhost:${PORT}`);
});
