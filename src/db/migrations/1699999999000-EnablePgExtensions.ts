import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgExtensions1699999999000 implements MigrationInterface {
  name = 'EnablePgExtensions1699999999000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Extensions are shared DB capabilities; keep them installed on rollback.
  }
}
