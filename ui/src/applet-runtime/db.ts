import { engine } from './engine';

export type DBConstraint = {
  field: string
  op: 'eq'
  value: unknown
}

export type DBIndexConstraint = DBConstraint & {
  name: string
}

export type DBQueryOptions = {
  index?: DBIndexConstraint
  filters?: DBConstraint[]
  order?: 'asc' | 'desc'
  take?: number
}

export type DBQueryIndex = {
  eq(field: string, value: unknown): DBQueryIndex
}

export type DBQueryFilter = {
  eq(field: string, value: unknown): DBQueryFilter
}

export type DBQueryBuilder<T> = {
  withIndex(name: string, build: (q: DBQueryIndex) => DBQueryIndex | void): DBQueryBuilder<T>
  filter(build: (q: DBQueryFilter) => DBQueryFilter | void): DBQueryBuilder<T>
  order(direction: 'asc' | 'desc'): DBQueryBuilder<T>
  take(limit: number): DBQueryBuilder<T>
  collect(): Promise<T[]>
  first(): Promise<T | null>
}

type DBCaller = <T>(op: string, params: Record<string, unknown>) => Promise<T>

export type DBClient = {
  get<T = unknown>(id: string): Promise<T | null>
  query<T = unknown>(table: string): DBQueryBuilder<T>
  queryRaw<T = unknown>(table: string, query?: DBQueryOptions): Promise<T[]>
  insert<T = unknown>(table: string, value: unknown): Promise<T>
  patch<T = unknown>(id: string, value: unknown): Promise<T>
  replace<T = unknown>(id: string, value: unknown): Promise<T>
  delete(id: string): Promise<boolean>
}

export function createDB(caller: DBCaller): DBClient {
  class QueryIndexBuilder implements DBQueryIndex {
    private constraint?: DBConstraint;

    eq(field: string, value: unknown): QueryIndexBuilder {
      this.constraint = { field, op: 'eq', value };
      return this;
    }

    build(name: string): DBIndexConstraint | undefined {
      if (!this.constraint) {
        return undefined;
      }
      return { name, ...this.constraint };
    }
  }

  class QueryFilterBuilder implements DBQueryFilter {
    private constraints: DBConstraint[] = [];

    eq(field: string, value: unknown): QueryFilterBuilder {
      this.constraints.push({ field, op: 'eq', value });
      return this;
    }

    build(): DBConstraint[] {
      return this.constraints;
    }
  }

  class RuntimeQueryBuilder<T> implements DBQueryBuilder<T> {
    constructor(
      private readonly table: string,
      private readonly options: DBQueryOptions = {},
    ) {}

    withIndex(name: string, build: (q: DBQueryIndex) => DBQueryIndex | void): RuntimeQueryBuilder<T> {
      const index = new QueryIndexBuilder();
      build(index);
      return new RuntimeQueryBuilder<T>(this.table, {
        ...this.options,
        index: index.build(name),
      });
    }

    filter(build: (q: DBQueryFilter) => DBQueryFilter | void): RuntimeQueryBuilder<T> {
      const filter = new QueryFilterBuilder();
      build(filter);
      return new RuntimeQueryBuilder<T>(this.table, {
        ...this.options,
        filters: [...(this.options.filters ?? []), ...filter.build()],
      });
    }

    order(direction: 'asc' | 'desc'): RuntimeQueryBuilder<T> {
      return new RuntimeQueryBuilder<T>(this.table, {
        ...this.options,
        order: direction,
      });
    }

    take(limit: number): RuntimeQueryBuilder<T> {
      return new RuntimeQueryBuilder<T>(this.table, {
        ...this.options,
        take: limit,
      });
    }

    collect(): Promise<T[]> {
      return caller<T[]>('query', { table: this.table, query: this.options });
    }

    async first(): Promise<T | null> {
      const rows = await this.take(1).collect();
      return rows[0] ?? null;
    }
  }

  const client: DBClient = {
    get<T = unknown>(id: string): Promise<T | null> {
      return caller<T | null>('get', { id });
    },
    query<T = unknown>(table: string): RuntimeQueryBuilder<T> {
      return new RuntimeQueryBuilder<T>(table);
    },
    queryRaw<T = unknown>(table: string, query?: DBQueryOptions): Promise<T[]> {
      return caller<T[]>('query', { table, query: query ?? {} });
    },
    insert<T = unknown>(table: string, value: unknown): Promise<T> {
      return caller<T>('insert', { table, value });
    },
    patch<T = unknown>(id: string, value: unknown): Promise<T> {
      return caller<T>('patch', { id, value });
    },
    replace<T = unknown>(id: string, value: unknown): Promise<T> {
      return caller<T>('replace', { id, value });
    },
    delete(id: string): Promise<boolean> {
      return caller<boolean>('delete', { id });
    },
  };
  return client;
}

export const db = createDB((op, params) => engine.call(appletMethod(op), params));

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID;
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required');
  }
  return `${appletID}.db.${op}`;
}
