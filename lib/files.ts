import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const ALLOWED_EXTENSIONS = new Set([".docx", ".doc", ".txt", ".pdf", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `Файл слишком большой. Максимум — 10 МБ (у вас ${(file.size / 1024 / 1024).toFixed(1)} МБ)`;
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `Тип файла не разрешён. Допустимые форматы: docx, doc, txt, pdf, xlsx, xls, png, jpg, jpeg`;
  }
  return null;
}

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function saveUploadedFile(file: File): Promise<{ fileName: string; filePath: string }> {
  await ensureUploadsDir();
  const ext = path.extname(file.name);
  const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9а-яА-Я\-_]/g, "_");
  const fileName = `${Date.now()}-${base}${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  return { fileName, filePath };
}

export async function extractTextFromFile(file: File, filePath: string): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();

  if (ext === ".txt") {
    const buffer = Buffer.from(await file.arrayBuffer());
    return buffer.toString("utf-8");
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return "";
}

export function getFileIcon(fileName: string | null): string {
  if (!fileName) return "📄";
  const ext = path.extname(fileName).toLowerCase();
  const icons: Record<string, string> = {
    ".docx": "📝", ".doc": "📝",
    ".pdf": "📕",
    ".txt": "📄",
    ".xlsx": "📊", ".xls": "📊",
    ".png": "🖼", ".jpg": "🖼", ".jpeg": "🖼",
  };
  return icons[ext] ?? "📎";
}
