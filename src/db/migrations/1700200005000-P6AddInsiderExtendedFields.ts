import { MigrationInterface, QueryRunner } from 'typeorm';

export class P6AddInsiderExtendedFields1700200005000 implements MigrationInterface {
  name = 'P6AddInsiderExtendedFields1700200005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "insider_trading_events" ADD COLUMN IF NOT EXISTS "announceDate" date`);
    await queryRunner.query(`ALTER TABLE "insider_trading_events" ADD COLUMN IF NOT EXISTS "dealMethod" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "insider_trading_events" ADD COLUMN IF NOT EXISTS "actionType" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "insider_trading_events" ADD COLUMN IF NOT EXISTS "ownershipRatio" numeric(10,4)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "insider_trading_events" DROP COLUMN IF EXISTS "ownershipRatio"`);
    await queryRunner.query(`ALTER TABLE "insider_trading_events" DROP COLUMN IF EXISTS "actionType"`);
    await queryRunner.query(`ALTER TABLE "insider_trading_events" DROP COLUMN IF EXISTS "dealMethod"`);
    await queryRunner.query(`ALTER TABLE "insider_trading_events" DROP COLUMN IF EXISTS "announceDate"`);
  }
}
