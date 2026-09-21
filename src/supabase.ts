import { io, Socket } from 'socket.io-client';

// Determine Socket.IO / API endpoint
const getOrigin = () => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

// Singleton socket connection
let socketInstance: Socket | null = null;
export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(getOrigin(), {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
};

// Event listener registry for realtime changes
type ChangeHandler = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new?: any;
  old?: any;
}) => void;

const changeHandlers: { [table: string]: Set<ChangeHandler> } = {};

if (typeof window !== 'undefined') {
  const s = getSocket();
  s.on('postgres_changes', (payload: any) => {
    const table = payload.table;
    const handlers = changeHandlers[table];
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(payload);
        } catch (e) {
          console.error(`Error in postgres_changes handler for ${table}:`, e);
        }
      });
    }
    // Also trigger global '*' handlers if any
    const globalHandlers = changeHandlers['*'];
    if (globalHandlers) {
      globalHandlers.forEach(fn => {
        try {
          fn(payload);
        } catch (e) {
          console.error('Error in global postgres_changes handler:', e);
        }
      });
    }
  });
}

class QueryBuilder<T = any> implements PromiseLike<{ data: T | null; error: any; count?: number | null }> {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any = null;
  private filters: { [key: string]: string } = {};
  private sortCol: string | null = null;
  private sortAsc: boolean = true;
  private limitNum: number | null = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols: string = '*', _options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    if (this.action !== 'insert') {
      this.action = 'select';
    }
    return this;
  }

  insert(data: any): this {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  upsert(data: any, _options?: any): this {
    this.action = 'upsert';
    this.payload = data;
    return this;
  }

  update(data: any): this {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete(): this {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any): this {
    this.filters[column] = `eq.${value}`;
    return this;
  }

  neq(column: string, value: any): this {
    this.filters[column] = `neq.${value}`;
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters[column] = `ilike.${pattern}`;
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters[column] = `in.(${values.join(',')})`;
    return this;
  }

  or(filterStr: string): this {
    this.filters['or'] = filterStr;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.sortCol = column;
    this.sortAsc = options?.ascending !== false;
    return this;
  }

  limit(num: number): this {
    this.limitNum = num;
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingle = true;
    return this;
  }

  private async execute(): Promise<{ data: any; error: any; count?: number | null }> {
    const origin = getOrigin();
    const queryParams = new URLSearchParams();

    for (const [k, v] of Object.entries(this.filters)) {
      queryParams.set(k, v);
    }
    if (this.sortCol) {
      queryParams.set('order', `${this.sortCol}.${this.sortAsc ? 'asc' : 'desc'}`);
    }
    if (this.limitNum !== null) {
      queryParams.set('limit', String(this.limitNum));
    }
    if (this.isSingle) {
      queryParams.set('single', 'true');
    }
    if (this.isMaybeSingle) {
      queryParams.set('maybeSingle', 'true');
    }

    const qs = queryParams.toString();
    const url = `${origin}/api/db/${this.table}${qs ? `?${qs}` : ''}`;

    try {
      if (this.action === 'select') {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return {
          data: json.data,
          error: json.error,
          count: Array.isArray(json.data) ? json.data.length : null,
        };
      }

      if (this.action === 'insert') {
        const res = await fetch(`${origin}/api/db/${this.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }

      if (this.action === 'upsert') {
        const res = await fetch(`${origin}/api/db/${this.table}/upsert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }

      if (this.action === 'update') {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }

      if (this.action === 'delete') {
        const res = await fetch(url, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }

      return { data: null, error: null, count: null };
    } catch (err: any) {
      console.warn(`Query execution warning on ${this.table}:`, err);
      return { data: null, error: err, count: null };
    }
  }

  then<TResult1 = { data: T | null; error: any; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | null; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class RealtimeChannel {
  private channelName: string;
  private presenceMap: Record<string, any[]> = {};
  private broadcastHandlers: { [event: string]: Set<(data: any) => void> } = {};
  private presenceHandlers: { [event: string]: Set<(data: any) => void> } = {};

  constructor(name: string) {
    this.channelName = name;

    if (typeof window !== 'undefined') {
      const s = getSocket();
      s.on('broadcast_msg', (msg: { event: string; payload: any }) => {
        if (msg && msg.event) {
          const handlers = this.broadcastHandlers[msg.event];
          if (handlers) {
            handlers.forEach(fn => fn({ payload: msg.payload }));
          }
        }
      });

      s.on('presence_state', (list: any[]) => {
        this.presenceMap['presence'] = list.map(item => ({
          username: item.username,
          avatar: item.avatar,
          onlineAt: item.last_seen || new Date().toISOString(),
        }));

        const syncFns = this.presenceHandlers['sync'];
        if (syncFns) {
          syncFns.forEach(fn => fn({}));
        }
      });
    }
  }

  on(
    type: string,
    filter: { event?: string; schema?: string; table?: string },
    callback: (payload: any) => void
  ): this {
    if (type === 'postgres_changes') {
      const table = filter?.table || '*';
      if (!changeHandlers[table]) {
        changeHandlers[table] = new Set();
      }
      changeHandlers[table].add(callback);
    } else if (type === 'broadcast') {
      const ev = filter?.event || '*';
      if (!this.broadcastHandlers[ev]) {
        this.broadcastHandlers[ev] = new Set();
      }
      this.broadcastHandlers[ev].add(callback);
    } else if (type === 'presence') {
      const ev = filter?.event || 'sync';
      if (!this.presenceHandlers[ev]) {
        this.presenceHandlers[ev] = new Set();
      }
      this.presenceHandlers[ev].add(callback);
    }
    return this;
  }

  presenceState(): Record<string, any[]> {
    return this.presenceMap;
  }

  async track(presence: { username: string; avatar?: string; onlineAt?: string }): Promise<void> {
    if (typeof window !== 'undefined') {
      const s = getSocket();
      s.emit('join', {
        username: presence.username,
        avatar: presence.avatar || '',
      });
    }
  }

  async untrack(): Promise<void> {
    if (typeof window !== 'undefined') {
      const s = getSocket();
      s.emit('leave');
    }
  }

  async send(data: { type: string; event: string; payload: any }): Promise<void> {
    if (typeof window !== 'undefined') {
      const s = getSocket();
      s.emit('broadcast_msg', {
        event: data.event,
        payload: data.payload,
      });
    }
  }

  subscribe(callback?: (status: string) => void): this {
    if (callback) {
      setTimeout(() => callback('SUBSCRIBED'), 0);
    }
    return this;
  }

  unsubscribe(): void {
    // Cleanup handlers if needed
  }
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  channel: (name: string) => new RealtimeChannel(name),
  removeChannel: (channel?: any) => {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  },
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
  },
};
