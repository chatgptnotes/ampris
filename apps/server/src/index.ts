import { createServer } from 'http';
import app from './app';
import { env } from './config/environment';
import { connectDatabase, disconnectDatabase } from './config/database';
import { realtimeService } from './services/realtime.service';
import { alarmService } from './services/alarm.service';

async function main(): Promise<void> {
  console.log('Starting GridVision SCADA Server...');

  // Connect to database
  await connectDatabase();

  // Initialize alarm engine
  await alarmService.initialize();

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize WebSocket / real-time service
  realtimeService.initialize(httpServer);

  // Start the MSEDCL simulator — begins generating data immediately
  realtimeService.startSimulator();

  // Start HTTP server
  httpServer.listen(env.PORT, () => {
    console.log(`GridVision SCADA Server running on port ${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`API: http://localhost:${env.PORT}/api`);
    console.log(`Health: http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      await disconnectDatabase();
      console.log('Server closed.');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
