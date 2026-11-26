// Data source for the TypeORM CLI only (see the migration:* npm scripts). The app builds its own in AppModule.
import { DataSource } from 'typeorm';
import { envSchema } from '../config/env.schema.js';
import { buildDatabaseOptions } from './database.options.js';
import { RefreshToken } from '../modules/auth/refresh-token.entity.js';
import { Category } from '../modules/categories/category.entity.js';
import { Post } from '../modules/posts/post.entity.js';
import { User } from '../modules/users/user.entity.js';

const env = envSchema.parse(process.env);

export default new DataSource({
  ...buildDatabaseOptions(env),
  entities: [User, RefreshToken, Category, Post],
  migrationsRun: false,
});
