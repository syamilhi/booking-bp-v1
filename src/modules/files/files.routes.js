import { Router } from 'express';
import { filesController } from './files.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/middleware/rbac.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { requestUploadUrlSchema, fileIdParamSchema } from './files.schema.js';

export const filesRouter = Router();

// Protect all files endpoints
filesRouter.use(authenticate);

filesRouter.post('/upload-url', requirePermission('files:upload'), validate(requestUploadUrlSchema), filesController.requestUploadUrl);
filesRouter.post('/:id/confirm', requirePermission('files:upload'), validate(fileIdParamSchema), filesController.confirmUpload);
filesRouter.get('/:id', requirePermission('files:read'), validate(fileIdParamSchema), filesController.getFile);
filesRouter.get('/:id/download-url', requirePermission('files:read'), validate(fileIdParamSchema), filesController.getDownloadUrl);
filesRouter.delete('/:id', requirePermission('files:delete'), validate(fileIdParamSchema), filesController.deleteFile);

