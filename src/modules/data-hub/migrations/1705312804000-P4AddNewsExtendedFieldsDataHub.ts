import { MigrationInterface, QueryRunner } from 'typeorm';

export class P4AddNewsExtendedFieldsDataHub1705312804000
  implements MigrationInterface
{
  name = 'P4AddNewsExtendedFieldsDataHub1705312804000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "news_article" ADD COLUMN IF NOT EXISTS "provider_news_id" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" ADD COLUMN IF NOT EXISTS "lang_code" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" ADD COLUMN IF NOT EXISTS "source_link" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" ADD COLUMN IF NOT EXISTS "news_image_url" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" ADD COLUMN IF NOT EXISTS "subtitle" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" ADD COLUMN IF NOT EXISTS "source_created_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" ADD COLUMN IF NOT EXISTS "source_updated_at" TIMESTAMPTZ`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_news_article_source_provider_news_id" ON "news_article" ("source_id", "provider_news_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_news_article_source_provider_news_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" DROP COLUMN IF EXISTS "source_updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_article" DROP COLUMN IF EXISTS "source_created_at"`,
    );
    await queryRunner.query(`ALTER TABLE "news_article" DROP COLUMN IF EXISTS "subtitle"`);
    await queryRunner.query(
      `ALTER TABLE "news_article" DROP COLUMN IF EXISTS "news_image_url"`,
    );
    await queryRunner.query(`ALTER TABLE "news_article" DROP COLUMN IF EXISTS "source_link"`);
    await queryRunner.query(`ALTER TABLE "news_article" DROP COLUMN IF EXISTS "lang_code"`);
    await queryRunner.query(
      `ALTER TABLE "news_article" DROP COLUMN IF EXISTS "provider_news_id"`,
    );
  }
}
