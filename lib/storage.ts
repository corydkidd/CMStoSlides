import fs from 'fs/promises';
import path from 'path';

const STORAGE_ROOT = process.env.UPLOAD_DIR || '/app/data';

/**
 * Save an uploaded file to the uploads directory.
 * Returns the relative path (from STORAGE_ROOT) for DB storage.
 */
export async function saveUpload(
  userId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = `uploads/${userId}/${timestamp}_${safeName}`;
  const absolutePath = path.join(STORAGE_ROOT, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return relativePath;
}

/**
 * Save a generated output file to the outputs directory.
 * Returns the relative path (from STORAGE_ROOT) for DB storage.
 */
export async function saveOutput(
  userId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = `outputs/${userId}/${timestamp}_${safeName}`;
  const absolutePath = path.join(STORAGE_ROOT, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return relativePath;
}

/**
 * Get the absolute filesystem path for a relative storage path.
 */
export function getFilePath(relativePath: string): string {
  return path.join(STORAGE_ROOT, relativePath);
}

/**
 * Read a file and return its contents as a Buffer.
 */
export async function getFileBuffer(relativePath: string): Promise<Buffer> {
  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  return fs.readFile(absolutePath);
}

/**
 * Check if a file exists at the given relative path.
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const absolutePath = path.join(STORAGE_ROOT, relativePath);
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a file at the given relative path.
 */
export async function deleteFile(relativePath: string): Promise<void> {
  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  await fs.unlink(absolutePath);
}
