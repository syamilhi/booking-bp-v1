import { z } from 'zod';

const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = {
  body: z.object({
    email: z.string().email('Invalid email address format').toLowerCase().trim(),
    password: passwordValidation,
    firstName: z.string().min(1, 'First name is required').max(100).trim(),
    lastName: z.string().min(1, 'Last name is required').max(100).trim(),
    phone: z.string().max(50).optional()
  })
};

export const loginSchema = {
  body: z.object({
    email: z.string().email('Invalid email address format').toLowerCase().trim(),
    password: z.string().min(1, 'Password is required')
  })
};

export const verifyEmailSchema = {
  body: z.object({
    token: z.string().min(1, 'Verification token is required')
  })
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email('Invalid email address format').toLowerCase().trim()
  })
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordValidation
  })
};

