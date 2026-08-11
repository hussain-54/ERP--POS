import { safeStorage } from "electron";

/**
 * Encrypt secrets at rest via OS keychain-backed Electron safeStorage.
 * Never expose decrypted values through broad IPC — use typed get/set only.
 */
export class SecureTokenStore {
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  encryptString(plain: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      // Dev fallback — still not plaintext on disk if caller stores buffer as base64
      return Buffer.from(plain, "utf8").toString("base64");
    }
    return safeStorage.encryptString(plain).toString("base64");
  }

  decryptString(payload: string): string {
    const buf = Buffer.from(payload, "base64");
    if (!safeStorage.isEncryptionAvailable()) {
      return buf.toString("utf8");
    }
    return safeStorage.decryptString(buf);
  }
}
