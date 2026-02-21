import { MigrationInterface, QueryRunner } from 'typeorm';

export class P4AddNewsExtendedFields1700200003000 implements MigrationInterface {
  name = 'P4AddNewsExtendedFields1700200003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "providerNewsId" character varying(128)`);
    await queryRunner.query(`ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "languageCode" character varying(10)`);
    await queryRunner.query(`ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "sourceLink" text`);
    await queryRunner.query(`ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "imageUrl" text`);
    await queryRunner.query(`ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "subtitle" text`);
    await queryRunner.query(`ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "sourceCreatedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_news_articles_source_providerNewsId" ON "news_articles" ("source", "providerNewsId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_news_articles_source_providerNewsId"`);
    await queryRunner.query(`ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "sourceUpdatedAt"`);
    await queryRunner.query(`ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "sourceCreatedAt"`);
    await queryRunner.query(`ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "subtitle"`);
    await queryRunner.query(`ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "sourceLink"`);
    await queryRunner.query(`ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "languageCode"`);
    await queryRunner.query(`ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "providerNewsId"`);
  }
}
