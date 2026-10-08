import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

export const validateEnvironment =
  <T extends object>(type: ClassConstructor<T>) =>
  (raw: Record<string, unknown>): T => {
    const environment = plainToInstance(type, raw, { enableImplicitConversion: true });
    const errors = validateSync(environment);
    if (errors.length > 0) {
      const details = errors
        .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
        .join('; ');
      throw new Error(`Invalid environment: ${details}`);
    }
    return environment;
  };
