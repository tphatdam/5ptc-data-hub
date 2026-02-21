import { MigrationInterface, QueryRunner } from 'typeorm';

export class P2AddStockCandleExtendedMetrics1705312802000
  implements MigrationInterface
{
  name = 'P2AddStockCandleExtendedMetrics1705312802000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_candle" ADD COLUMN IF NOT EXISTS "foreign_buy_volume" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" ADD COLUMN IF NOT EXISTS "foreign_sell_volume" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" ADD COLUMN IF NOT EXISTS "foreign_net_volume" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" ADD COLUMN IF NOT EXISTS "put_through_volume" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" ADD COLUMN IF NOT EXISTS "put_through_value" numeric(22,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" ADD COLUMN IF NOT EXISTS "total_trades" bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stock_candle" DROP COLUMN IF EXISTS "total_trades"`);
    await queryRunner.query(
      `ALTER TABLE "stock_candle" DROP COLUMN IF EXISTS "put_through_value"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" DROP COLUMN IF EXISTS "put_through_volume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" DROP COLUMN IF EXISTS "foreign_net_volume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" DROP COLUMN IF EXISTS "foreign_sell_volume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_candle" DROP COLUMN IF EXISTS "foreign_buy_volume"`,
    );
  }
}
