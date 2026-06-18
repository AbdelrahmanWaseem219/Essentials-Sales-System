import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as xmlrpc from 'xmlrpc';

/**
 * Thin XML-RPC wrapper over Odoo's external API.
 *  - /xmlrpc/2/common  → authenticate
 *  - /xmlrpc/2/object  → execute_kw(model, method, args, kwargs)
 *
 * Works against Odoo Community out of the box; no custom addon needed.
 */
@Injectable()
export class OdooClient {
  private readonly logger = new Logger(OdooClient.name);
  private uid: number | null = null;

  private readonly url: string;
  private readonly db: string;
  private readonly username: string;
  private readonly password: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>('odoo.url')!;
    this.db = config.get<string>('odoo.db')!;
    this.username = config.get<string>('odoo.username')!;
    this.password = config.get<string>('odoo.password')!;
  }

  private endpoint(path: string) {
    const secure = this.url.startsWith('https');
    const factory = secure ? xmlrpc.createSecureClient : xmlrpc.createClient;
    return factory({ url: `${this.url}/xmlrpc/2/${path}` });
  }

  private call<T>(client: xmlrpc.Client, method: string, params: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      client.methodCall(method, params, (err: unknown, value: T) =>
        err ? reject(err) : resolve(value),
      );
    });
  }

  /** Authenticate once and cache the uid. */
  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    const common = this.endpoint('common');
    const uid = await this.call<number>(common, 'authenticate', [
      this.db,
      this.username,
      this.password,
      {},
    ]);
    if (!uid) throw new Error('Odoo authentication failed — check ODOO_* credentials');
    this.uid = uid;
    this.logger.log(`Authenticated with Odoo as uid=${uid}`);
    return uid;
  }

  /** Generic execute_kw. Re-authenticates once if the cached session/uid has
   *  expired, so the integration recovers instead of failing forever after an
   *  Odoo restart / session GC / credential rotation. */
  async execute<T = unknown>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
    retriedAfterAuth = false,
  ): Promise<T> {
    const uid = await this.authenticate();
    const object = this.endpoint('object');
    try {
      return await this.call<T>(object, 'execute_kw', [
        this.db,
        uid,
        this.password,
        model,
        method,
        args,
        kwargs,
      ]);
    } catch (err) {
      if (!retriedAfterAuth && this.isAuthError(err)) {
        this.logger.warn('Odoo session looks expired — re-authenticating and retrying once');
        this.uid = null;
        return this.execute<T>(model, method, args, kwargs, true);
      }
      throw err;
    }
  }

  /** Heuristic: does this XML-RPC fault indicate an expired/invalid session? */
  private isAuthError(err: unknown): boolean {
    const msg = String((err as { faultString?: string })?.faultString ?? (err as Error)?.message ?? err).toLowerCase();
    return (
      msg.includes('session expired') ||
      msg.includes('session_expired') ||
      msg.includes('access denied') ||
      msg.includes('expired') ||
      (msg.includes('invalid') && msg.includes('session'))
    );
  }

  searchRead<T = any>(
    model: string,
    domain: unknown[] = [],
    fields: string[] = [],
    opts: { limit?: number; offset?: number; order?: string } = {},
  ): Promise<T[]> {
    return this.execute<T[]>(model, 'search_read', [domain], { fields, ...opts });
  }

  create(model: string, values: Record<string, unknown>): Promise<number> {
    return this.execute<number>(model, 'create', [values]);
  }

  write(model: string, ids: number[], values: Record<string, unknown>): Promise<boolean> {
    return this.execute<boolean>(model, 'write', [ids, values]);
  }

  callMethod<T = unknown>(model: string, method: string, ids: number[]): Promise<T> {
    return this.execute<T>(model, method, [ids]);
  }
}
