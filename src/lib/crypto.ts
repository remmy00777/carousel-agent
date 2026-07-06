import crypto from "crypto";

function key(): Buffer {
  const secret =
    process.env.APP_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "dev-insecure-key-do-not-use-in-prod";
  return crypto.createHash("sha256").update(secret).digest();
}

/** AES-256-GCM encryption for secrets at rest (e.g. Instagram access tokens). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, enc] = token.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
