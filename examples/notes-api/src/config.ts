/** Settings read from the environment, with their defaults */
export interface Config {
  port: number;
  /** Whether the store starts with the sample notes */
  seed: boolean;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT must be a port number, not "${env.PORT}"`);
  return { port, seed: env.SEED !== '0' };
}
