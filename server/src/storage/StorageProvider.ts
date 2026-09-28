import type { Readable } from "node:stream";

export interface StorageProvider {
  upload(input: { key: string; buffer: Buffer; contentType: string }): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}

export class StorageObjectNotFoundError extends Error {
  constructor() { super("Storage object not found"); }
}
