import { createApp } from './app';
import { loadConfig } from './config';
import { logLine } from './observability/log';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await createApp(config);
  await app.listen(config.port, '0.0.0.0');
  logLine('info', 'listening', { port: config.port });
}

main().catch(error => {
  logLine('error', 'failed to start', { reason: error instanceof Error ? error.message : 'unknown' });
  process.exit(1);
});
