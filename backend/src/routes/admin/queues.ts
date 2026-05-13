import { Router, type Request, type Response } from 'express';
import { Queue } from 'bullmq';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

export const adminQueuesRouter: import('express').Router = Router();

const connection = { url: config.redisUrl };

const QUEUE_NAMES = ['scrape-queue', 'alert-queue', 'system-queue', 'discovery-queue'] as const;
type QueueName = typeof QUEUE_NAMES[number];

function getQueue(name: string | string[]): Queue | null {
  const n = String(Array.isArray(name) ? name[0] : name);
  if (!QUEUE_NAMES.includes(n as QueueName)) return null;
  return new Queue(n, { connection });
}

adminQueuesRouter.get('/', async (_req: Request, res: Response) => {
  const results = await Promise.all(
    QUEUE_NAMES.map(async name => {
      const q = new Queue(name, { connection });
      try {
        const [counts, isPaused] = await Promise.all([
          q.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
          q.isPaused(),
        ]);
        return { name, ...counts, isPaused };
      } finally {
        await q.close();
      }
    })
  );
  res.json(results);
});

adminQueuesRouter.get('/:name/failed', async (req: Request, res: Response) => {
  const q = getQueue(req.params.name);
  if (!q) { res.status(404).json({ error: 'Unknown queue' }); return; }

  const page = Math.max(0, parseInt(req.query.page as string) || 0);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const start = page * limit;

  try {
    const jobs = await q.getFailed(start, start + limit - 1);
    res.json(jobs.map(j => ({
      id: j.id,
      name: j.name,
      attemptsMade: j.attemptsMade,
      failedReason: j.failedReason,
      finishedOn: j.finishedOn,
      data: j.data,
    })));
  } finally {
    await q.close();
  }
});

adminQueuesRouter.post('/:name/retry/:jobId', async (req: Request, res: Response) => {
  const q = getQueue(req.params.name);
  if (!q) { res.status(404).json({ error: 'Unknown queue' }); return; }
  const jobId = String(req.params.jobId);

  try {
    const job = await q.getJob(jobId);
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    await job.retry('failed');
    logger.info({ adminAction: true, action: 'retry_job', jobId }, 'Admin retried job');
    res.json({ ok: true });
  } finally {
    await q.close();
  }
});

adminQueuesRouter.delete('/:name/failed/:jobId', async (req: Request, res: Response) => {
  const q = getQueue(req.params.name);
  if (!q) { res.status(404).json({ error: 'Unknown queue' }); return; }
  const jobId = String(req.params.jobId);

  try {
    const job = await q.getJob(jobId);
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    await job.remove();
    logger.info({ adminAction: true, action: 'discard_job', jobId }, 'Admin discarded job');
    res.json({ ok: true });
  } finally {
    await q.close();
  }
});

adminQueuesRouter.post('/:name/pause', async (req: Request, res: Response) => {
  const q = getQueue(req.params.name);
  if (!q) { res.status(404).json({ error: 'Unknown queue' }); return; }
  const queueName = String(req.params.name);
  try {
    await q.pause();
    logger.info({ adminAction: true, action: 'pause_queue', queue: queueName }, 'Admin paused queue');
    res.json({ ok: true });
  } finally {
    await q.close();
  }
});

adminQueuesRouter.post('/:name/resume', async (req: Request, res: Response) => {
  const q = getQueue(req.params.name);
  if (!q) { res.status(404).json({ error: 'Unknown queue' }); return; }
  const queueName = String(req.params.name);
  try {
    await q.resume();
    logger.info({ adminAction: true, action: 'resume_queue', queue: queueName }, 'Admin resumed queue');
    res.json({ ok: true });
  } finally {
    await q.close();
  }
});

adminQueuesRouter.post('/:name/drain', async (req: Request, res: Response) => {
  const q = getQueue(req.params.name);
  if (!q) { res.status(404).json({ error: 'Unknown queue' }); return; }
  const queueName = String(req.params.name);
  try {
    await q.drain();
    logger.info({ adminAction: true, action: 'drain_queue', queue: queueName }, 'Admin drained queue');
    res.json({ ok: true });
  } finally {
    await q.close();
  }
});
