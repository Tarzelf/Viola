import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StorageProvider } from '../types.js';

/**
 * Storage.
 *
 * Local filesystem for development and tests; Supabase Storage in production.
 * Both are addressed by the same logical paths, so nothing downstream — the
 * renderer, the API, the clients — needs to know which is in play.
 */

export class LocalFsStorageProvider implements StorageProvider {
  readonly name = 'local';
  readonly costCents = 0;

  private readonly root: string;

  constructor(
    root = process.env.VIOLA_STORAGE_DIR ?? '.viola-storage',
    private readonly baseUrl = '/api/media',
  ) {
    this.root = resolve(root);
  }

  private full(path: string): string {
    // Refuse to escape the storage root.
    const target = resolve(join(this.root, path));
    if (!target.startsWith(this.root)) throw new Error(`unsafe storage path: ${path}`);
    return target;
  }

  async put(path: string, data: Buffer, _contentType?: string): Promise<string> {
    const target = this.full(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    return path;
  }

  async get(path: string): Promise<Buffer | null> {
    try {
      return await readFile(this.full(path));
    } catch {
      return null;
    }
  }

  publicUrl(path: string): string {
    return `${this.baseUrl}/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    return (await this.get(path)) !== null;
  }

  async remove(path: string): Promise<void> {
    await rm(this.full(path), { force: true });
  }
}

/** Purely in-memory. Used by tests so nothing touches the disk. */
export class MemoryStorageProvider implements StorageProvider {
  readonly name = 'memory';
  readonly costCents = 0;

  private readonly files = new Map<string, Buffer>();

  async put(path: string, data: Buffer, _contentType?: string): Promise<string> {
    this.files.set(path, data);
    return path;
  }

  async get(path: string): Promise<Buffer | null> {
    return this.files.get(path) ?? null;
  }

  publicUrl(path: string): string {
    return `/api/media/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  get size(): number {
    return this.files.size;
  }

  keys(): string[] {
    return [...this.files.keys()];
  }
}

export interface SupabaseStorageOptions {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  fetchImpl?: typeof fetch;
}

export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';
  readonly costCents = 0;

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseStorageOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private endpoint(path: string): string {
    return `${this.options.url}/storage/v1/object/${this.options.bucket}/${path}`;
  }

  private get headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.options.serviceRoleKey}`,
      apikey: this.options.serviceRoleKey,
    };
  }

  async put(path: string, data: Buffer, contentType: string): Promise<string> {
    const response = await this.fetchImpl(this.endpoint(path), {
      method: 'POST',
      headers: { ...this.headers, 'content-type': contentType, 'x-upsert': 'true' },
      body: new Uint8Array(data),
    });
    if (!response.ok) {
      throw new Error(`supabase storage put ${response.status}: ${await response.text()}`);
    }
    return path;
  }

  async get(path: string): Promise<Buffer | null> {
    const response = await this.fetchImpl(this.endpoint(path), { headers: this.headers });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  publicUrl(path: string): string {
    return `${this.options.url}/storage/v1/object/public/${this.options.bucket}/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    const response = await this.fetchImpl(this.endpoint(path), {
      method: 'HEAD',
      headers: this.headers,
    });
    return response.ok;
  }

  async remove(path: string): Promise<void> {
    await this.fetchImpl(this.endpoint(path), { method: 'DELETE', headers: this.headers });
  }
}
