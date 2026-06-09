import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/svg+xml", "image/webp"];

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type. Only images are allowed." }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 });
        }

        // Ensure upload directory exists
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }

        // Generate unique filename
        const ext = path.extname(file.name) || ".png";
        const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        const uniqueName = `${baseName}_${Date.now()}${ext}`;
        const filePath = path.join(UPLOAD_DIR, uniqueName);

        // Write file
        const bytes = await file.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(bytes));

        // Return the public URL path
        const publicUrl = `/uploads/${uniqueName}`;
        return NextResponse.json({ success: true, url: publicUrl, filename: uniqueName });
    } catch (error) {
        console.error("[API] Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
