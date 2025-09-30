import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

declare global {
  // Update the type to accept both the base client and extended client
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}

const createPrismaClient = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Base configuration
  const config: any = {
    log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  };

  // Set datasource URL based on environment
  if (isDevelopment) {
    config.datasources = {
      db: {
        url: process.env.LOCAL_DATABASE_URL
      }
    };
  } else if (isProduction) {
    config.datasources = {
      db: {
        url: process.env.DATABASE_URL
      }
    };
  }

  const baseClient = new PrismaClient(config);

  // Only use Accelerate in production with proper prisma+ URL
  if (isProduction && process.env.DATABASE_URL?.startsWith('prisma+')) {
    return baseClient.$extends(withAccelerate());
  }

  return baseClient;
};

const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

export default prisma;