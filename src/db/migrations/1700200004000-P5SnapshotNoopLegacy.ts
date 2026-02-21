import { MigrationInterface, QueryRunner } from 'typeorm';

export class P5SnapshotNoopLegacy1700200004000 implements MigrationInterface {
  name = 'P5SnapshotNoopLegacy1700200004000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Legacy schema has no stock snapshot table.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op rollback.
  }
}
