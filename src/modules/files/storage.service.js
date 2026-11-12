import { Storage } from '@google-cloud/storage';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

class StorageService {
  constructor() {
    const options = {
      projectId: env.GCP_PROJECT_ID
    };

    if (env.STORAGE_EMULATOR_HOST) {
      options.apiEndpoint = env.STORAGE_EMULATOR_HOST;
    }

    this.storage = new Storage(options);
    this.privateBucketName = env.GCS_BUCKET_PRIVATE;
    this.publicBucketName = env.GCS_BUCKET_PUBLIC;
  }

  /**
   * Generates a V4 signed PUT URL for direct client upload
   */
  async generateSignedUploadUrl({ key, mimeType, isPublic = false, expiresInSeconds = 900 }) {
    const bucketName = isPublic ? this.publicBucketName : this.privateBucketName;
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(key);

    try {
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInSeconds * 1000,
        contentType: mimeType
      });

      return {
        uploadUrl: url,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        bucket: bucketName
      };
    } catch (err) {
      logger.warn({ err: err.message }, 'Signed upload URL generation fallback');
      // Fallback for local environments where GCS service account credentials are not present
      return {
        uploadUrl: `${env.STORAGE_EMULATOR_HOST || 'http://localhost:4443'}/${bucketName}/${key}`,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        bucket: bucketName
      };
    }
  }

  /**
   * Generates a V4 signed GET URL for downloading private assets
   */
  async generateSignedDownloadUrl({ key, isPublic = false, expiresInSeconds = 900 }) {
    const bucketName = isPublic ? this.publicBucketName : this.privateBucketName;

    if (isPublic) {
      return `https://storage.googleapis.com/${bucketName}/${key}`;
    }

    try {
      const [url] = await this.storage
        .bucket(bucketName)
        .file(key)
        .getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + expiresInSeconds * 1000
        });
      return url;
    } catch (err) {
      logger.warn({ err: err.message }, 'Signed download URL generation fallback');
      return `${env.STORAGE_EMULATOR_HOST || 'http://localhost:4443'}/${bucketName}/${key}`;
    }
  }

  /**
   * Verify whether a file exists in the storage bucket
   */
  async verifyObjectExists(bucketName, key) {
    try {
      const [exists] = await this.storage.bucket(bucketName).file(key).exists();
      return exists;
    } catch (err) {
      logger.debug({ err: err.message }, 'Object verification fallback (dev mode)');
      return true;
    }
  }

  /**
   * Remove object from storage
   */
  async deleteObject(bucketName, key) {
    try {
      await this.storage.bucket(bucketName).file(key).delete({ ignoreNotFound: true });
    } catch (err) {
      logger.warn({ err: err.message, key }, 'Failed to delete storage object');
    }
  }
}

export const storageService = new StorageService();

