import type { DataSourceOptions } from 'typeorm';
import type { Env } from '../config/env.schema.js';
import { InitAuth1764028800000 } from './migrations/1764028800000-init-auth.js';
import { CategoriesPosts1764115200000 } from './migrations/1764115200000-categories-posts.js';

type DbEnv = Pick<
  Env,
  | 'DB_HOST'
  | 'DB_PORT'
  | 'DB_USER'
  | 'DB_PASSWORD'
  | 'DB_NAME'
  | 'DB_MIGRATIONS_RUN'
  | 'DB_LOGGING'
>;

/** Migrations are listed explicitly so they load the same way under Nest, Vitest and the TypeORM CLI. */
export const migrations = [InitAuth1764028800000, CategoriesPosts1764115200000];

export function buildDatabaseOptions(env: DbEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    synchronize: false,
    migrations,
    migrationsRun: env.DB_MIGRATIONS_RUN,
    logging: env.DB_LOGGING,
  };
}
