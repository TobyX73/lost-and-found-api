import type { MigrationInterface, QueryRunner } from 'typeorm';

const CATEGORIES: Array<[slug: string, name: string]> = [
  ['billeteras', 'Billeteras y carteras'],
  ['llaves', 'Llaves'],
  ['documentos', 'Documentos y tarjetas'],
  ['celulares', 'Celulares'],
  ['electronica', 'Electrónica'],
  ['mochilas-bolsos', 'Mochilas y bolsos'],
  ['ropa', 'Ropa y accesorios'],
  ['joyeria', 'Joyería y relojes'],
  ['anteojos', 'Anteojos'],
  ['mascotas', 'Mascotas'],
  ['bicicletas', 'Bicicletas y monopatines'],
  ['otros', 'Otros'],
];

export class CategoriesPosts1764115200000 implements MigrationInterface {
  name = 'CategoriesPosts1764115200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // unaccent() is only STABLE, so it cannot be used in a generated column or index directly.
    await queryRunner.query(`
      CREATE FUNCTION f_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
    `);

    await queryRunner.query(`
      CREATE TABLE categories (
        id   smallserial PRIMARY KEY,
        slug varchar(40) NOT NULL UNIQUE,
        name varchar(60) NOT NULL
      )
    `);
    const values = CATEGORIES.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    await queryRunner.query(
      `INSERT INTO categories (slug, name) VALUES ${values}`,
      CATEGORIES.flat(),
    );

    await queryRunner.query(`CREATE TYPE post_type AS ENUM ('LOST', 'FOUND')`);
    await queryRunner.query(
      `CREATE TYPE post_status AS ENUM ('OPEN', 'MATCHED', 'RESOLVED', 'EXPIRED')`,
    );

    await queryRunner.query(`
      CREATE TABLE posts (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        type             post_type   NOT NULL,
        status           post_status NOT NULL DEFAULT 'OPEN',
        title            varchar(120) NOT NULL,
        description      text NOT NULL,
        category_id      smallint NOT NULL REFERENCES categories (id),
        attributes       jsonb NOT NULL DEFAULT '{}',
        occurred_at      timestamptz NOT NULL,
        location         geography(Point, 4326) NOT NULL,
        public_location  geography(Point, 4326) NOT NULL,
        radius_m         integer NOT NULL CHECK (radius_m BETWEEN 10 AND 5000),
        location_label   varchar(120),
        search_vector    tsvector GENERATED ALWAYS AS (
          setweight(to_tsvector('spanish', f_unaccent(coalesce(title, ''))), 'A') ||
          setweight(to_tsvector('spanish', f_unaccent(coalesce(description, ''))), 'B')
        ) STORED,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX posts_location_idx ON posts USING gist (location)`);
    await queryRunner.query(`CREATE INDEX posts_search_vector_idx ON posts USING gin (search_vector)`);
    await queryRunner.query(
      `CREATE INDEX posts_title_trgm_idx ON posts USING gin (f_unaccent(lower(title)) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX posts_filter_idx ON posts (type, status, category_id, occurred_at)`,
    );
    await queryRunner.query(`CREATE INDEX posts_author_idx ON posts (author_id, created_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE posts`);
    await queryRunner.query(`DROP TYPE post_status`);
    await queryRunner.query(`DROP TYPE post_type`);
    await queryRunner.query(`DROP TABLE categories`);
    await queryRunner.query(`DROP FUNCTION f_unaccent(text)`);
  }
}
