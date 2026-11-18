export interface BuyerSupabaseConfig {
  url: string;
  anonKey: string;
}

export function isSupabaseConfigured(): boolean {
  return true;
}

export function getSupabaseConfigInfo(): { url: string; anonKey: string; source: 'local' | 'env' | 'unset' } {
  return {
    url: '/api/db (Self-Hosted Local Database)',
    anonKey: 'local',
    source: 'local',
  };
}

export function saveBuyerSupabaseConfig(_url: string, _anonKey: string): void {
  // No-op: using self-hosted local database
}

export function clearBuyerSupabaseConfig(): void {
  // No-op: using self-hosted local database
}

interface FilterItem {
  col: string;
  op: string;
  val: any;
}

interface OrderItem {
  col: string;
  ascending: boolean;
}

interface QueryResult<T = any> {
  data: T;
  error: any;
  count?: number | null;
}

class LocalQueryBuilder implements PromiseLike<QueryResult> {
  private table: string;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private onConflictCol?: string;
  private filters: FilterItem[] = [];
  private orders: OrderItem[] = [];
  private limitVal?: number;
  private rangeVal?: [number, number];
  private isSingle = false;
  private isMaybeSingle = false;
  private isHead = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    if (this.action === 'select') {
      this.action = 'select';
    }
    if (options?.head) {
      this.isHead = true;
    }
    return this;
  }

  insert(values: any) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = values;
    if (options?.onConflict) {
      this.onConflictCol = options.onConflict;
    }
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push({ col, op: 'neq', val });
    return this;
  }

  gt(col: string, val: any) {
    this.filters.push({ col, op: 'gt', val });
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push({ col, op: 'gte', val });
    return this;
  }

  lt(col: string, val: any) {
    this.filters.push({ col, op: 'lt', val });
    return this;
  }

  lte(col: string, val: any) {
    this.filters.push({ col, op: 'lte', val });
    return this;
  }

  is(col: string, val: any) {
    this.filters.push({ col, op: 'is', val });
    return this;
  }

  in(col: string, val: any[]) {
    this.filters.push({ col, op: 'in', val });
    return this;
  }

  like(col: string, val: string) {
    this.filters.push({ col, op: 'like', val });
    return this;
  }

  ilike(col: string, val: string) {
    this.filters.push({ col, op: 'ilike', val });
    return this;
  }

  contains(col: string, val: any) {
    this.filters.push({ col, op: 'contains', val });
    return this;
  }

  or(expr: string) {
    this.filters.push({ col: '', op: 'or', val: expr });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: options?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  range(from: number, to: number) {
    this.rangeVal = [from, to];
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private async execute(): Promise<QueryResult> {
    const requestBody = JSON.stringify({
      table: this.table,
      action: this.action,
      payload: this.payload,
      onConflict: this.onConflictCol,
      filters: this.filters,
      orders: this.orders,
      limit: this.limitVal,
      range: this.rangeVal,
      single: this.isSingle,
      maybeSingle: this.isMaybeSingle,
      head: this.isHead,
    });

    const endpoints = ['/api/db', '/db-api.php'];
    let lastError = 'Local DB request failed';

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          lastError = `Database HTTP ${res.status} (${endpoint})`;
          continue;
        }
        const json = await res.json();
        return {
          data: json.data ?? (this.isSingle || this.isMaybeSingle || this.isHead ? null : []),
          error: json.error ?? null,
          count: typeof json.count === 'number' ? json.count : null,
        };
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }

    return {
      data: this.isSingle || this.isMaybeSingle || this.isHead ? null : [],
      error: { message: lastError },
      count: 0,
    };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const noopChannel = {
  on: () => noopChannel,
  subscribe: () => noopChannel,
  unsubscribe: async () => 'ok',
};

export const supabase: any = {
  from: (table: string) => new LocalQueryBuilder(table),
  rpc: async (_fn: string, _params?: any) => ({ data: null, error: null }),
  channel: (_name: string) => noopChannel,
  removeChannel: async (_ch: any) => 'ok',
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};
