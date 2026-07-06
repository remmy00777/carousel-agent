import { promises as fs } from "fs";
import path from "path";

export interface StorageDriver {
  put(key: string, data: Buffer): Promise<{ key: string }>;
  read(key: string): Promise<Buffer>;
}

class LocalStorage implements StorageDriver {
  private root = process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), "storage");

  private resolve(key: string): string {
    const p = path.normalize(path.join(this.root, key));
    if (!p.startsWith(path.normalize(this.root))) throw new Error("Invalid storage key");
    return p;
  }

  async put(key: string, data: Buffer) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
    return { key };
  }

  async read(key: string) {
    return fs.readFile(this.resolve(key));
  }
}

/**
 * S3-compatible driver stub. To enable: `npm i @aws-sdk/client-s3`, implement
 * put/read with S3_BUCKET/S3_REGION/S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY,
 * and set STORAGE_DRIVER=s3. The rest of the app only depends on this interface.
 */
class S3Storage implements StorageDriver {
  async put(): Promise<{ key: string }> {
    throw new Error("S3 storage driver not implemented in MVP. Use STORAGE_DRIVER=local or implement S3Storage in src/lib/storage/index.ts.");
  }
  async read(): Promise<Buffer> {
    throw new Error("S3 storage driver not implemented in MVP. Use STORAGE_DRIVER=local or implement S3Storage in src/lib/storage/index.ts.");
  }
}

export function getStorage(): StorageDriver {
  return (process.env.STORAGE_DRIVER ?? "local").toLowerCase() === "s3"
    ? new S3Storage()
    : new LocalStorage();
}

/** URL where a stored asset is served. Absolute if PUBLIC_ASSET_BASE_URL is set (needed for real IG publishing). */
export function assetPublicUrl(key: string): string {
  const base = process.env.PUBLIC_ASSET_BASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/api/assets/${key}` : `/api/assets/${key}`;
}
