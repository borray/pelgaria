import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // Prevent path traversal
  const safe = path.basename(filename);
  const filePath = path.join(process.cwd(), "uploads", safe);

  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`,
        "Content-Type": "application/octet-stream",
      },
    });
  } catch {
    return new NextResponse("Файл не найден", { status: 404 });
  }
}
