import { authService } from './auth.service.js';
import { env } from '../../config/env.js';

const isProduction = env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  path: '/',
  maxAge: env.REFRESH_TOKEN_EXPIRES_IN * 1000
};

export class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register({
        tenantId: req.tenant.id,
        ...req.body
      });

      res.status(201).json({
        success: true,
        data: result.user,
        meta: {
          verificationToken: env.NODE_ENV !== 'production' ? result.verificationToken : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login({
        tenantId: req.tenant.id,
        email: req.body.email,
        password: req.body.password,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      const result = await authService.refreshTokens({
        rawRefreshToken,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      await authService.logout({ rawRefreshToken });

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/'
      });

      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully.' }
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const result = await authService.verifyEmail({ token: req.body.token });
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword({
        tenantId: req.tenant.id,
        email: req.body.email
      });

      res.status(200).json({
        success: true,
        data: { message: result.message },
        meta: {
          resetToken: env.NODE_ENV !== 'production' ? result.resetToken : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword({
        token: req.body.token,
        newPassword: req.body.newPassword
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req, res) {
    res.status(200).json({
      success: true,
      data: req.user
    });
  }
}

export const authController = new AuthController();

