import { auditService } from './audit.service.js';

export class AuditController {
  async listAuditLogs(req, res, next) {
    try {
      const result = await auditService.listAuditLogs(req.tenant.id, req.query);
      res.status(200).json({
        success: true,
        data: result.logs,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async listActivities(req, res, next) {
    try {
      const result = await auditService.listActivities(req.tenant.id, req.query);
      res.status(200).json({
        success: true,
        data: result.activities,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();

