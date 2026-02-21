import { MigrationInterface, QueryRunner } from 'typeorm';

export class P2AddDailyExtendedMetrics1700200001000 implements MigrationInterface {
  name = 'P2AddDailyExtendedMetrics1700200001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quote_daily" ADD COLUMN IF NOT EXISTS "value" numeric(22,4)`);
    await queryRunner.query(`ALTER TABLE "quote_daily" ADD COLUMN IF NOT EXISTS "putThroughVolume" bigint`);
    await queryRunner.query(`ALTER TABLE "quote_daily" ADD COLUMN IF NOT EXISTS "putThroughValue" numeric(22,4)`);
    await queryRunner.query(`ALTER TABLE "quote_daily" ADD COLUMN IF NOT EXISTS "foreignBuyVolume" bigint`);
    await queryRunner.query(`ALTER TABLE "quote_daily" ADD COLUMN IF NOT EXISTS "foreignSellVolume" bigint`);
    await queryRunner.query(`ALTER TABLE "quote_daily" ADD COLUMN IF NOT EXISTS "foreignNetVolume" bigint`);
    await queryRunner.query(`ALTER TABLE "quote_daily" ADD COLUMN IF NOT EXISTS "totalTrades" bigint`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP COLUMN IF EXISTS "totalTrades"`);
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP COLUMN IF EXISTS "foreignNetVolume"`);
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP COLUMN IF EXISTS "foreignSellVolume"`);
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP COLUMN IF EXISTS "foreignBuyVolume"`);
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP COLUMN IF EXISTS "putThroughValue"`);
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP COLUMN IF EXISTS "putThroughVolume"`);
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP COLUMN IF EXISTS "value"`);
  }
}
