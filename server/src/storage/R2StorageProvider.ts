import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { StorageObjectNotFoundError, type StorageProvider } from "./StorageProvider";

const isMissing = (error: unknown) => {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === "NoSuchKey" || value.name === "NotFound" || value.$metadata?.httpStatusCode === 404;
};

export class R2StorageProvider implements StorageProvider {
  constructor(private readonly client: S3Client, private readonly bucket: string) {}

  async upload({ key, buffer, contentType }: Parameters<StorageProvider["upload"]>[0]) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
  }

  async getStream(key: string) {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!(result.Body instanceof Readable)) throw new Error("Storage returned an invalid stream");
      return result.Body;
    } catch (error) {
      if (isMissing(error)) throw new StorageObjectNotFoundError();
      throw error;
    }
  }

  async delete(key: string) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  getSignedUrl(key: string, expiresInSeconds = 300) {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 604800) throw new Error("Invalid URL expiry");
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }
}
