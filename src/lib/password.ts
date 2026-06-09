import { compareSync } from "bcryptjs";
import { pbkdf2Sync, randomBytes } from "node:crypto";

/**
 * Hash a password using native PBKDF2-SHA512.
 * Much faster than bcryptjs (pure JS) while remaining cryptographically secure.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const iterations = 10000;
  const hash = pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

/**
 * Verify a password against a stored hash (supports both fast PBKDF2 and legacy bcrypt).
 */
export function comparePassword(password: string, storedHash: string): boolean {
  if (isBcryptHash(storedHash)) {
    return compareSync(password, storedHash);
  }
  const parts = storedHash.split("$");
  if (parts[0] === "pbkdf2") {
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const hash = parts[3];
    const verifyHash = pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
    return hash === verifyHash;
  }
  return false;
}

/**
 * Check if the stored hash is in the old bcrypt format.
 */
export function isBcryptHash(storedHash: string): boolean {
  return storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$");
}
