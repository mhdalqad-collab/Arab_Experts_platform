import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getWebPool } from './database.mjs';

export function createDatabaseStorage(pool) {
  if (pool?.dialect !== 'mysql') throw new Error('Database file storage requires MySQL');
  return {
    async put(key, bytes, options) {
      const body = Buffer.from(bytes);
      if (!key || key.length > 512 || body.length > 10 * 1024 * 1024) throw new Error('Invalid private file size or key');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO web_objects(object_key,size_bytes,metadata_json) VALUES($1,$2,$3)
          ON CONFLICT(object_key) DO UPDATE SET size_bytes=excluded.size_bytes, metadata_json=excluded.metadata_json`, [key, body.length, JSON.stringify(options || {})]);
        await client.query('DELETE FROM web_object_chunks WHERE object_key=$1', [key]);
        for (let offset=0, index=0; offset<body.length; offset+=262144, index++) {
          await client.query('INSERT INTO web_object_chunks(object_key,chunk_index,body) VALUES($1,$2,$3)', [key,index,body.subarray(offset,offset+262144)]);
        }
        await client.query('COMMIT');
      } catch(error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async get(key) {
      // A single query gives a consistent snapshot while another request replaces a file.
      const result=await pool.query(`SELECT o.size_bytes, c.body FROM web_objects o
        LEFT JOIN web_object_chunks c ON c.object_key=o.object_key WHERE o.object_key=$1 ORDER BY c.chunk_index`,[key]);
      if(!result.rows.length) return null;
      const bytes=Buffer.concat(result.rows.map(row=>row.body).filter(Boolean));
      if(bytes.length!==Number(result.rows[0].size_bytes)) throw new Error('Incomplete private file');
      return {size:bytes.length, body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(bytes));controller.close();}})};
    },
    async delete(key) { await pool.query('DELETE FROM web_objects WHERE object_key=$1',[key]); },
  };
}

export function createObjectStorage(environment = process.env, suppliedClient) {
  if (environment.WEB_STORAGE_DRIVER === 'mysql') return createDatabaseStorage(suppliedClient || getWebPool());
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
