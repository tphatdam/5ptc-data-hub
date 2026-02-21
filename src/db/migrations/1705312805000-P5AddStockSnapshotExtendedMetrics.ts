import { MigrationInterface, QueryRunner } from 'typeorm';

export class P5AddStockSnapshotExtendedMetrics1705312805000
  implements MigrationInterface
{
  name = 'P5AddStockSnapshotExtendedMetrics1705312805000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "pb" numeric(10,4)`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "ps" numeric(10,4)`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "roe" numeric(10,4)`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "roa" numeric(10,4)`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "ev" numeric(22,4)`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "foreign_room" bigint`);
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "foreign_holding_room" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "current_holding_ratio" numeric(10,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "max_holding_ratio" numeric(10,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" ADD COLUMN IF NOT EXISTS "avg_match_volume_2w" bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "avg_match_volume_2w"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "max_holding_ratio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "current_holding_ratio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "foreign_holding_room"`,
    );
    await queryRunner.query(`ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "foreign_room"`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "ev"`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "roa"`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "roe"`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "ps"`);
    await queryRunner.query(`ALTER TABLE "stock_snapshot" DROP COLUMN IF EXISTS "pb"`);
  }
}
