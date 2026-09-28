import { S3Client } from "@aws-sdk/client-s3";
import { LocalStorageProvider } from "./LocalStorageProvider";
import { R2StorageProvider } from "./R2StorageProvider";
import type { StorageProvider } from "./StorageProvider";

const providers = new Map<string, StorageProvider>();

export function getStorageProviderName() {
  const name = process.env.STORAGE_PROVIDER ?? "local";
  if (name !== "local" && name !== "r2") throw new Error("STORAGE_PROVIDER must be local or r2");
  return name;
}

export function getStorageProvider(name: string = getStorageProviderName()): StorageProvider {
  const cached = providers.get(name);
  if (cached) return cached;
  let provider: StorageProvider;
  if (name === "local") {
    provider = new LocalStorageProvider();
  } else if (name === "r2") {
    const required = (key: string) => {
      const value = process.env[key]?.trim();
      if (!value) throw new Error(`Missing storage configuration: ${key}`);
      return value;
    };
    const endpoint = process.env.R2_ENDPOINT || `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("R2_ENDPOINT must be an HTTPS URL without credentials");
    provider = new R2StorageProvider(new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }), required("R2_BUCKET_NAME"));
  } else {
    throw new Error("Unsupported document storage provider");
  }
  providers.set(name, provider);
  return provider;
}
