import {
  DeleteObjectsCommand,
  type DeleteObjectsCommandOutput,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

export class MediaS3DeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaS3DeleteError";
  }
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export class MediaS3Service {
  private readonly client: S3Client;

  private readonly bucket: string;

  constructor() {
    const endpoint = requiredEnv("S3_ENDPOINT");
    const region = process.env["S3_REGION"] ?? "us-east-1";
    const accessKeyId = requiredEnv("S3_ACCESS_KEY");
    const secretAccessKey = requiredEnv("S3_SECRET_KEY");

    this.bucket = requiredEnv("S3_BUCKET");
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: asBool(process.env["S3_FORCE_PATH_STYLE"], true),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  getStorageKey(ownerId: number, nodeId: string, filename: string): string {
    const safeName = filename.replace(/\/+|\\+/g, "_").replace(/\s+/g, " ").trim();
    const effectiveName = safeName.length > 0 ? safeName : "file";
    return `${ownerId}/${nodeId}/${effectiveName}`;
  }

  async createUploadUrl(storageKey: string, contentType?: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: DEFAULT_SIGNED_URL_TTL_SECONDS });
  }

  async createDownloadUrl(storageKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: DEFAULT_SIGNED_URL_TTL_SECONDS });
  }

  async getObjectBytes(storageKey: string): Promise<{
    bytes: Uint8Array;
    contentType?: string;
    contentLength?: number;
  } | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }));
      if (!result.Body) return null;
      const body = result.Body as { transformToByteArray?: () => Promise<Uint8Array> };
      if (!body.transformToByteArray) {
        throw new Error("S3 object body cannot be converted to bytes");
      }
      return {
        bytes: await body.transformToByteArray(),
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      };
    } catch (error) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound" || err?.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async objectExists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }));
      return true;
    } catch (error) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound" || err?.name === "NoSuchKey") {
        return false;
      }
      throw error;
    }
  }

  async getObjectSize(storageKey: string): Promise<number | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }));
      return result.ContentLength ?? null;
    } catch (error) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound" || err?.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async deleteObjects(storageKeys: string[]): Promise<void> {
    if (storageKeys.length === 0) return;
    for (let i = 0; i < storageKeys.length; i += 1000) {
      const chunk = storageKeys.slice(i, i + 1000);
      const result: DeleteObjectsCommandOutput = await this.client.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: chunk.map(Key => ({ Key })),
          Quiet: true,
        },
      }));

      if (result.Errors && result.Errors.length > 0) {
        const detail = result.Errors
          .map(err => `${err.Key ?? "unknown"}:${err.Code ?? "Unknown"}`)
          .join(", ");
        throw new MediaS3DeleteError(`Failed to delete some S3 objects: ${detail}`);
      }
    }
  }
}
