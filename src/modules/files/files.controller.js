import { filesService } from './files.service.js';

export class FilesController {
  async requestUploadUrl(req, res, next) {
    try {
      const result = await filesService.createUploadRequest(
        req.tenant.id,
        req.user.id,
        req.body
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async confirmUpload(req, res, next) {
    try {
      const result = await filesService.confirmUpload(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getFile(req, res, next) {
    try {
      const result = await filesService.getFileMetadata(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getDownloadUrl(req, res, next) {
    try {
      const result = await filesService.getDownloadUrl(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req, res, next) {
    try {
      const result = await filesService.deleteFile(req.tenant.id, req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const filesController = new FilesController();

