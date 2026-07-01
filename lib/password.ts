import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "crypto";

function scrypt(password: string, salt: string, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}
const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
  });

  return `scrypt:${DEFAULT_N}:${DEFAULT_R}:${DEFAULT_P}:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const parts = hash.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, salt, key] = parts;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = await scrypt(password, salt, keyBuffer.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  if (derivedKey.length !== keyBuffer.length) return false;
  return timingSafeEqual(derivedKey, keyBuffer);
}
