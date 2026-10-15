import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export function createObjectStorage(environment = process.env, suppliedClient) {
  if (!environment.WEB_STORAGE_BUCKET) return null;
  const client = suppliedClient || new S3Client({
    region: environment.WEB_STORAGE_REGION || 'auto',
    endpoint: environment.WEB_STORAGE_ENDPOINT || undefined,
    credentials: {
      accessKeyId: environment.WEB_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: environment.WEB_STORAGE_SECRET_ACCESS_KEY,
    },
    requestHandler: { requestTimeout: 30000, connectionTimeout: 5000 },
  });
  const Bucket = environment.WEB_STORAGE_BUCKET;
  return {
    async put(Key, bytes, options) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body: new Uint8Array(bytes),
        ContentType: options?.httpMetadata?.contentType,
        Metadata: options?.customMetadata,
      }));
    },
    async get(Key) {
      try {
        const object = await client.send(new GetObjectCommand({ Bucket, Key }));
        return { body: object.Body.transformToWebStream(), size: object.ContentLength };
      } catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async delete(Key) { await client.send(new DeleteObjectCommand({ Bucket, Key })); },
  };
}
