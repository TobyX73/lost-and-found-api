import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuth1764028800000 implements MigrationInterface {
  name = 'InitAuth1764028800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    await queryRunner.query(`
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         varchar(254) NOT NULL,
        password_hash varchar(255) NOT NULL,
        display_name  varchar(50)  NOT NULL,
        created_at    timestamptz  NOT NULL DEFAULT now(),
        updated_at    timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_email_key ON users (lower(email))`,
    );

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        family_id   uuid         NOT NULL,
        token_hash  char(64)     NOT NULL,
        expires_at  timestamptz  NOT NULL,
        used_at     timestamptz,
        revoked_at  timestamptz,
        created_at  timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON refresh_tokens (token_hash)`,
    );
    await queryRunner.query(
      `CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE refresh_tokens`);
    await queryRunner.query(`DROP TABLE users`);
  }
}
