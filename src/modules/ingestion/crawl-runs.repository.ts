import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrawlRun, CrawlRunStatus } from '../../db/entities/crawl-run.entity';

export interface CreateRunDto {
  jobName: string;
  source: string;
}

export type CrawlRunStats = Record<string, any>;

@Injectable()
export class CrawlRunsRepository {
  private readonly logger = new Logger(CrawlRunsRepository.name);

  constructor(
    @InjectRepository(CrawlRun)
    private readonly crawlRunRepository: Repository<CrawlRun>,
  ) {}

  /**
   * Create a new crawl run with status RUNNING.
   * Sets startedAt to current timestamp.
   */
  async createRun(data: CreateRunDto): Promise<CrawlRun> {
    try {
      const crawlRun = this.crawlRunRepository.create({
        jobName: data.jobName,
        source: data.source,
        startedAt: new Date(),
        status: CrawlRunStatus.RUNNING,
        endedAt: null,
        errorText: null,
        statsJson: null,
      });

      const saved = await this.crawlRunRepository.save(crawlRun);
      this.logger.log(
        `Created crawl run ${saved.id} for job ${data.jobName} from source ${data.source}`,
      );

      return saved;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to create crawl run for job ${data.jobName}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Mark a crawl run as successful.
   * Updates status to SUCCESS, sets endedAt to current timestamp, and stores statistics.
   */
  async markSuccess(id: string, stats: CrawlRunStats): Promise<void> {
    try {
      const result = await this.crawlRunRepository.update(id, {
        status: CrawlRunStatus.SUCCESS,
        endedAt: new Date(),
        statsJson: stats as any,
      });

      if (result.affected === 0) {
        throw new Error(`Crawl run ${id} not found`);
      }

      this.logger.log(
        `Marked crawl run ${id} as SUCCESS with stats: ${JSON.stringify(stats)}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to mark crawl run ${id} as success: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Mark a crawl run as failed.
   * Updates status to FAILED, sets endedAt to current timestamp, stores error text and partial stats.
   */
  async markFailed(
    id: string,
    errorText: string,
    partialStats?: any,
  ): Promise<void> {
    try {
      const result = await this.crawlRunRepository.update(id, {
        status: CrawlRunStatus.FAILED,
        endedAt: new Date(),
        errorText,
        statsJson: partialStats || null,
      });

      if (result.affected === 0) {
        throw new Error(`Crawl run ${id} not found`);
      }

      this.logger.warn(
        `Marked crawl run ${id} as FAILED with error: ${errorText}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to mark crawl run ${id} as failed: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Get recent crawl runs for a specific job.
   * Returns runs ordered by startedAt descending (most recent first).
   */
  async getRecentRuns(jobName: string, limit: number): Promise<CrawlRun[]> {
    try {
      const runs = await this.crawlRunRepository.find({
        where: { jobName },
        order: { startedAt: 'DESC' },
        take: limit,
      });

      this.logger.debug(
        `Retrieved ${runs.length} recent runs for job ${jobName}`,
      );

      return runs;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to get recent runs for job ${jobName}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }
}
