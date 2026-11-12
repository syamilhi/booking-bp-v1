import { usersService } from './users.service.js';

export class UsersController {
  async listUsers(req, res, next) {
    try {
      const result = await usersService.listUsers(req.tenant.id, req.query);
      res.status(200).json({
        success: true,
        data: result.users,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async getUser(req, res, next) {
    try {
      const user = await usersService.getUserById(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req, res, next) {
    try {
      const user = await usersService.createUser(req.tenant.id, req.body);
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const user = await usersService.updateUser(req.tenant.id, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const result = await usersService.deleteUser(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async assignRoles(req, res, next) {
    try {
      const roles = await usersService.assignRoles(req.tenant.id, req.params.id, req.body.roleIds);
      res.status(200).json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();

