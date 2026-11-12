import crypto from 'node:crypto';
import { getTenantPrisma, systemPrisma } from '../../common/database.js';
import { storageService } from './storage.service.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';

export class FilesService {
  /**
   * Phase 1: Request signed upload URL
   */
  async createUploadRequest(tenantId, uploaderId, { originalName, mimeType, sizeBytes, isPublic = false }) {
    const tenantDb = getTenantPrisma(tenantId);

    // Sanitize file name and create a collision-proof storage key
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const randomHex = crypto.randomBytes(8).toString('hex');
    const key = `${tenantId}/${Date.now()}-${randomHex}-${safeName}`;

    const { uploadUrl, expiresAt, bucket } = await storageService.generateSignedUploadUrl({
      key,
      mimeType,
      isPublic
    });

    return systemPrisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          tenantId,
          uploaderId,
          key,
          originalName,
          mimeType,
          sizeBytes: BigInt(sizeBytes),
          bucket,
          isPublic,
          status: 'PENDING'
        }
      });

      await tx.upload.create({
        data: {
          tenantId,
          fileId: file.id,
          uploadUrl,
          expiresAt,
          status: 'PENDING'
        }
      });

      return {
        fileId: file.id,
        key: file.key,
        uploadUrl,
        expiresAt
      };
    });
  }

  /**
   * Phase 2: Confirm upload completion
   */
  async confirmUpload(tenantId, fileId) {
    const tenantDb = getTenantPrisma(tenantId);

    const file = await tenantDb.file.findFirst({
      where: { id: fileId }
    });

    if (!file) {
      throw new NotFoundError('File record not found.');
    }

    if (file.status === 'UPLOADED') {
      return { message: 'File is already confirmed and active.', file };
    }

    // Verify presence in storage
    const exists = await storageService.verifyObjectExists(file.bucket, file.key);
    if (!exists) {
      throw new BadRequestError('Uploaded binary was not found in storage bucket.');
    }

    await systemPrisma.$transaction([
      systemPrisma.file.update({
        where: { id: file.id },
        data: { status: 'UPLOADED' }
      }),
      systemPrisma.upload.updateMany({
        where: { fileId: file.id },
        data: { status: 'UPLOADED' }
      })
    ]);

    const updated = await tenantDb.file.findFirst({ where: { id: fileId } });

    return {
      message: 'Upload confirmed successfully.',
      file: {
        ...updated,
        sizeBytes: updated.sizeBytes.toString()
      }
    };
  }

  /**
   * Generate temporary download link
   */
  async getDownloadUrl(tenantId, fileId) {
    const tenantDb = getTenantPrisma(tenantId);

    const file = await tenantDb.file.findFirst({
      where: { id: fileId, status: 'UPLOADED' }
    });

    if (!file) {
      throw new NotFoundError('File not found or upload is not yet complete.');
    }

    const downloadUrl = await storageService.generateSignedDownloadUrl({
      key: file.key,
      isPublic: file.isPublic
    });

    return {
      fileId: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      isPublic: file.isPublic,
      downloadUrl,
      expiresInSeconds: 900
    };
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(tenantId, fileId) {
    const tenantDb = getTenantPrisma(tenantId);

    const file = await tenantDb.file.findFirst({
      where: { id: fileId }
    });

    if (!file) {
      throw new NotFoundError('File not found.');
    }

    return {
      ...file,
      sizeBytes: file.sizeBytes.toString()
    };
  }

  /**
   * Delete file
   */
  async deleteFile(tenantId, fileId) {
    const tenantDb = getTenantPrisma(tenantId);

    const file = await tenantDb.file.findFirst({
      where: { id: fileId }
    });

    if (!file) {
      throw new NotFoundError('File not found.');
    }

    await storageService.deleteObject(file.bucket, file.key);

    await tenantDb.file.updateMany({
      where: { id: fileId },
      data: { status: 'DELETED' }
    });

    return { message: 'File deleted successfully.' };
  }
}

export const filesService = new FilesService();

