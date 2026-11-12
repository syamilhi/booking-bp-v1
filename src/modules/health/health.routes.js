import { Router } from 'express';
import { healthController } from './health.controller.js';

export const healthRouter = Router();

healthRouter.get('/healthz', healthController.liveness);
healthRouter.get('/readyz', healthController.readiness);

