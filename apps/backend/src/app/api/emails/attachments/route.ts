import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createWriteStream, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";

import { authOptions } from "@/lib/auth";

const UPLOAD_DIR = "/tmp/email-attachments";

// Ensure upload directory exists
try {
  mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  // already exists
}

export interface AttachmentMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  path: string;
}

/**
 * POST /api/emails/attachments
 * Body: multipart/form-data with field "file"
 * Returns: { id, name, mimeType, size }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const filePath = path.join(UPLOAD_DIR, id);
    const metaPath = path.join(UPLOAD_DIR, `${id}.json`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filePath, buffer);
    const meta: AttachmentMeta = {
      id,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
      path: filePath,
    };
    await writeFile(metaPath, JSON.stringify(meta));

    return NextResponse.json({
      id,
      name: file.name,
      mimeType: meta.mimeType,
      size: meta.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to upload attachment", details: error.message },
      { status: 500 },
    );
  }
}
