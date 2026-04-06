export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toSafeError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof AppError) {
    return { message: error.message, statusCode: error.statusCode };
  }
  if (error instanceof Error) {
    // Log the real error server-side, return a safe message
    console.error('[LearnLoop Error]', error.message, error.stack);
    return { message: 'An unexpected error occurred. Please try again.', statusCode: 500 };
  }
  console.error('[LearnLoop Error]', error);
  return { message: 'An unexpected error occurred.', statusCode: 500 };
}
