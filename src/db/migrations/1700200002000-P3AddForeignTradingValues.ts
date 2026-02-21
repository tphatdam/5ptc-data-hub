import { MigrationInterface, QueryRunner } from 'typeorm';

export class P3AddForeignTradingValues1700200002000 implements MigrationInterface {
  name = 'P3AddForeignTradingValues1700200002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "foreign_trading_daily" ADD COLUMN IF NOT EXISTS "buyValue" numeric(22,4)`);
    await queryRunner.query(`ALTER TABLE "foreign_trading_daily" ADD COLUMN IF NOT EXISTS "sellValue" numeric(22,4)`);
    await queryRunner.query(`ALTER TABLE "foreign_trading_daily" ADD COLUMN IF NOT EXISTS "netValue" numeric(22,4)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "foreign_trading_daily" DROP COLUMN IF EXISTS "netValue"`);
    await queryRunner.query(`ALTER TABLE "foreign_trading_daily" DROP COLUMN IF EXISTS "sellValue"`);
    await queryRunner.query(`ALTER TABLE "foreign_trading_daily" DROP COLUMN IF EXISTS "buyValue"`);
  }
}
