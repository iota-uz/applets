import { z, type ZodRawShape, type ZodString } from 'zod';

export type TableIndex = {
  name: string
  fields: string[]
}

export type TableDefinition<T extends ZodRawShape> = {
  schema: z.ZodObject<T>
  indexes: TableIndex[]
  index(name: string, fields: string[]): TableDefinition<T>
}

export type SchemaDefinition<Tables extends Record<string, TableDefinition<any>>> = {
  tables: Tables
}

class RuntimeTableDefinition<T extends ZodRawShape> implements TableDefinition<T> {
  public readonly schema: z.ZodObject<T>;
  public readonly indexes: TableIndex[];

  constructor(schema: z.ZodObject<T>, indexes: TableIndex[] = []) {
    this.schema = schema;
    this.indexes = indexes;
  }

  index(name: string, fields: string[]): RuntimeTableDefinition<T> {
    return new RuntimeTableDefinition(this.schema, [
      ...this.indexes,
      {
        name,
        fields: [...fields],
      },
    ]);
  }
}

export function defineTable<T extends ZodRawShape>(shape: T): TableDefinition<T> {
  return new RuntimeTableDefinition(z.object(shape));
}

export function defineSchema<Tables extends Record<string, TableDefinition<any>>>(tables: Tables): SchemaDefinition<Tables> {
  return { tables };
}

// `id("users")` mirrors Convex-style typed id helper while staying Zod-compatible.
export function id(_tableName: string): ZodString {
  return z.string().min(1);
}

