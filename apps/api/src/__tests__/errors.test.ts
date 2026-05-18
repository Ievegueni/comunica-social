import { describe, it, expect } from 'vitest';
import { AppError } from '../lib/errors.js';

describe('AppError', () => {
  it('should create error with status code and message', () => {
    const error = new AppError(404, 'Not found');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.name).toBe('AppError');
  });

  it('should be an instance of Error', () => {
    const error = new AppError(500, 'Internal');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have a stack trace', () => {
    const error = new AppError(400, 'Bad request');
    expect(error.stack).toBeDefined();
  });
});
