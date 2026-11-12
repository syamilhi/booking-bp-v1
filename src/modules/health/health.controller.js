import { systemPrisma } from '../../common/database.js';
import { redisConnection } from '../../common/redis.js';

export class HealthController {
  /**
   * Liveness probe (checks process responsiveness)
   */
  liveness(req, res) {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Readiness probe (checks PostgreSQL and Redis connectivity)
   */
  async readiness(req, res) {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';

    try {
      await systemPrisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'unreachable';
    }

    try {
      const pong = await redisConnection.ping();
      if (pong === 'PONG') redisStatus = 'connected';
    } catch {
      redisStatus = 'unreachable';
    }

    const isReady = dbStatus === 'connected';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'unhealthy',
      database: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString()
    });
  }
}

export const healthController = new HealthController();

