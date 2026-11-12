import { z } from 'zod';

export const requestUploadUrlSchema = {
  body: z.object({
    originalName: z.string().min(1).max(255).trim(),
    mimeType: z.string().min(3).max(100).trim(),
    sizeBytes: z.coerce.number().positive(),
    isPublic: z.boolean().default(false)
  })
};

export const fileIdParamSchema = {
  params: z.object({
    id: z.string().uuid()
  })
};

