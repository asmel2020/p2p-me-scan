import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

const API = "https://api.cloudflare.com/client/v4";

type D1Result = {
  results: Record<string, unknown>[];
  success: boolean;
  meta?: { last_row_id?: number; changes?: number; duration?: number };
};

type D1Response = {
  success: boolean;
  errors?: { message: string }[];
  result?: D1Result[];
};

class D1RemoteClient {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;

  constructor(accountId: string, databaseId: string, apiToken: string) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
  }

  async query(sql: string, params: unknown[] = []): Promise<D1Result> {
    const url = `${API}/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });
    const data: D1Response = await res.json();
    if (!data.success || !data.result?.[0]) {
      throw new Error(`D1 error: ${data.errors?.[0]?.message ?? "unknown"}`);
    }
    return data.result[0];
  }

  prepare(sql: string) {
    return new D1RemoteStatement(this, sql);
  }

  async batch(statements: { sql: string; params: unknown[] }[]) {
    const results: D1Result[] = [];
    for (const stmt of statements) {
      results.push(await this.query(stmt.sql, stmt.params));
    }
    return results;
  }

  async exec(sql: string) {
    await this.query(sql);
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error("dump() no soportado desde Node.js");
  }
}

class D1RemoteStatement {
  private client: D1RemoteClient;
  private sql: string;
  private params: unknown[] = [];

  constructor(client: D1RemoteClient, sql: string) {
    this.client = client;
    this.sql = sql;
  }

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const result = await this.client.query(this.sql, this.params);
    return { results: result.results as T[] };
  }

  async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
    const result = await this.client.query(this.sql, this.params);
    if (!result.results.length) return null;
    if (col) return (result.results[0] as Record<string, T>)[col] ?? null;
    return result.results[0] as T;
  }

  async run() {
    await this.client.query(this.sql, this.params);
  }

  async raw(): Promise<unknown[][]> {
    const result = await this.client.query(this.sql, this.params);
    return result.results.map((r) => Object.values(r));
  }
}

export function initRemoteDB(
  accountId: string,
  databaseId: string,
  apiToken: string,
): DrizzleD1Database<typeof schema> {
  const client = new D1RemoteClient(accountId, databaseId, apiToken);
  return drizzle(client as unknown as import("@cloudflare/workers-types").D1Database, { schema }) as unknown as DrizzleD1Database<typeof schema>;
}

export function initDB(d1: import("@cloudflare/workers-types").D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}
