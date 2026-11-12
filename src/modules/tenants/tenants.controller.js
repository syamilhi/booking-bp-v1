import { tenantsService } from './tenants.service.js';

export class TenantsController {
  async createTenant(req, res, next) {
    try {
      const tenant = await tenantsService.createTenant(req.body);
      res.status(201).json({
        success: true,
        data: tenant
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentTenant(req, res, next) {
    try {
      const tenant = await tenantsService.getCurrentTenant(req.tenant.id);
      res.status(200).json({
        success: true,
        data: tenant
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCurrentTenant(req, res, next) {
    try {
      const tenant = await tenantsService.updateCurrentTenant(req.tenant.id, req.body);
      res.status(200).json({
        success: true,
        data: tenant
      });
    } catch (error) {
      next(error);
    }
  }

  async listAllTenants(req, res, next) {
    try {
      const tenants = await tenantsService.listAllTenants();
      res.status(200).json({
        success: true,
        data: tenants
      });
    } catch (error) {
      next(error);
    }
  }
}

export const tenantsController = new TenantsController();

