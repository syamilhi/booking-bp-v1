import { rolesService } from './roles.service.js';

export class RolesController {
  async listRoles(req, res, next) {
    try {
      const roles = await rolesService.listRoles(req.tenant.id);
      res.status(200).json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }

  async getRole(req, res, next) {
    try {
      const role = await rolesService.getRoleById(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  async createRole(req, res, next) {
    try {
      const role = await rolesService.createRole(req.tenant.id, req.body);
      res.status(201).json({
        success: true,
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req, res, next) {
    try {
      const role = await rolesService.updateRole(req.tenant.id, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRole(req, res, next) {
    try {
      const result = await rolesService.deleteRole(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listPermissions(req, res, next) {
    try {
      const permissions = await rolesService.listPermissions();
      res.status(200).json({
        success: true,
        data: permissions
      });
    } catch (error) {
      next(error);
    }
  }
}

export const rolesController = new RolesController();

