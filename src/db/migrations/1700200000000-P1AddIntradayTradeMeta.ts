import { MigrationInterface, QueryRunner } from 'typeorm';

export class P1AddIntradayTradeMeta1700200000000 implements MigrationInterface {
  name = 'P1AddIntradayTradeMeta1700200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quote_intraday" ADD COLUMN IF NOT EXISTS "matchType" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" ADD COLUMN IF NOT EXISTS "tradeId" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" ADD COLUMN IF NOT EXISTS "priceChange" double precision`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" ADD COLUMN IF NOT EXISTS "accumulatedVolume" bigint`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" ADD COLUMN IF NOT EXISTS "accumulatedValue" numeric(22,4)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quote_intraday" DROP COLUMN IF EXISTS "accumulatedValue"`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" DROP COLUMN IF EXISTS "accumulatedVolume"`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" DROP COLUMN IF EXISTS "priceChange"`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" DROP COLUMN IF EXISTS "tradeId"`);
    await queryRunner.query(`ALTER TABLE "quote_intraday" DROP COLUMN IF EXISTS "matchType"`);
  }
}
