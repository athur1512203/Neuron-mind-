import { promises as fs } from "node:fs";
import path from "node:path";
import { StorageObjectNotFoundError, type StorageProvider } from "./StorageProvider";

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly root = path.resolve(__dirname, "../../uploads/documents")) {}

  private resolve(key: string) {
    if (!key || key.split("/").some((part) => !part || part === "." || part === "..") || /[\\:\x00-\x1f]/.test(key)) {
      throw new Error("Invalid storage key");
    }
    const target = path.resolve(this.root, key);
    if (!target.startsWith(`${path.resolve(this.root)}${path.sep}`)) throw new Error("Invalid storage key");
    return target;
  }

  async upload({ key, buffer }: Parameters<StorageProvider["upload"]>[0]) {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const handle = await fs.open(target, "wx");
    try {
      await handle.writeFile(buffer);
    } catch (error) {
      await handle.close();
      await fs.rm(target, { force: true }).catch(() => undefined);
      throw error;
    } finally {
      await handle.close();
    }
  }

  async getStream(key: string) {
    try {
      const handle = await fs.open(this.resolve(key), "r");
      return handle.createReadStream();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageObjectNotFoundError();
      throw error;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string) {
    try {
      return (await fs.stat(this.resolve(key))).isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
}
