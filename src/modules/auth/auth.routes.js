import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { resolveTenant } from '../../common/middleware/tenant.middleware.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), resolveTenant, authController.register);
authRouter.post('/login', validate(loginSchema), resolveTenant, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
authRouter.post('/forgot-password', validate(forgotPasswordSchema), resolveTenant, authController.forgotPassword);
authRouter.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
authRouter.get('/me', authenticate, authController.me);
