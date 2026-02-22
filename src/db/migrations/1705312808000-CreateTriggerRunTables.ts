import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTriggerRunTables1705312808000 implements MigrationInterface {
  name = 'CreateTriggerRunTables1705312808000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trigger_run" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "mode" character varying(20) NOT NULL DEFAULT 'full',
        "status" character varying(20) NOT NULL,
        "accepted_at" TIMESTAMPTZ NOT NULL,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "summary_json" jsonb,
        "error_text" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trigger_run_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trigger_run_step" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL,
        "sequence" integer NOT NULL,
        "step" character varying(100) NOT NULL,
        "status" character varying(20) NOT NULL,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "error_text" text,
        "meta_json" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trigger_run_step_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trigger_run_step_run_id"
          FOREIGN KEY ("run_id")
          REFERENCES "trigger_run"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trigger_run_status_accepted_at"
      ON "trigger_run" ("status", "accepted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trigger_run_step_run_id_sequence"
      ON "trigger_run_step" ("run_id", "sequence")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trigger_run_step_run_id_sequence"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trigger_run_status_accepted_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "trigger_run_step"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trigger_run"`);
  }
}
