import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdvisoryLockService {
  private readonly logger = new Logger(AdvisoryLockService.name);

  constructor(private readonly dataSource: DataSource) {}

  async tryAcquire(lockName: string): Promise<boolean> {
    try {
      const result = await this.dataSource.query(
        `SELECT pg_try_advisory_lock(hashtext($1)) as acquired`,
        [lockName]
      );
      const acquired = result[0]?.acquired === true;
      if (acquired) {
        this.logger.debug(`Acquired advisory lock: ${lockName}`);
      } else {
        this.logger.debug(`Failed to acquire advisory lock: ${lockName} (already held)`);
      }
      return acquired;
    } catch (error: any) {
      this.logger.error(`Error acquiring advisory lock ${lockName}: ${error.message}`);
      return false;
    }
  }

  async release(lockName: string): Promise<boolean> {
    try {
      const result = await this.dataSource.query(
        `SELECT pg_advisory_unlock(hashtext($1)) as released`,
        [lockName]
      );
      const released = result[0]?.released === true;
      if (released) {
        this.logger.debug(`Released advisory lock: ${lockName}`);
      } else {
        this.logger.warn(`Lock ${lockName} was not held or already released`);
      }
      return released;
    } catch (error: any) {
      this.logger.error(`Error releasing advisory lock ${lockName}: ${error.message}`);
      return false;
    }
  }

  async withLock<T>(
    lockName: string,
    fn: () => Promise<T>,
    onSkip?: () => Promise<T> | T
  ): Promise<{ executed: boolean; result?: T }> {
    const acquired = await this.tryAcquire(lockName);
    if (!acquired) {
      if (onSkip) {
        return { executed: false, result: await onSkip() };
      }
      return { executed: false };
    }

    try {
      const result = await fn();
      return { executed: true, result };
    } finally {
      await this.release(lockName);
    }
  }
}
