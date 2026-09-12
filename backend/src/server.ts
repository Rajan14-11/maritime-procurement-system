import { createApp } from './app.js';
import prisma from './config/prisma.js';
import config from './config/env.js';

const PORT = config.port;

async function bootstrap() {
  try {
    const app = createApp();

    const server = app.listen(PORT, () => {
      console.log(`⚓ Maritime Procurement API server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down server gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Prisma disconnected. Process exiting.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Fatal error during startup:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
