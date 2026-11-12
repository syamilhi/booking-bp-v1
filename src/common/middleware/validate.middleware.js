import { ValidationError } from '../errors/app-error.js';

export const validate = (schema) => async (req, res, next) => {
  try {
    if (schema.body) {
      req.body = await schema.body.parseAsync(req.body);
    }
    if (schema.query) {
      req.query = await schema.query.parseAsync(req.query);
    }
    if (schema.params) {
      req.params = await schema.params.parseAsync(req.params);
    }
    next();
  } catch (error) {
    if (error.errors) {
      const details = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return next(new ValidationError('Request validation failed', details));
    }
    next(error);
  }
};

