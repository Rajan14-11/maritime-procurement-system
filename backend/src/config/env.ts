import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  throw new Error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is required and must not be empty.');
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  jwtSecret: JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;

export default config;
