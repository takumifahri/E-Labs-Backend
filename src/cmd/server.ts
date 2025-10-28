import app from "./app";
import config from "../code/config/config";
import { PrismaClient } from "@prisma/client";

app.listen(config.port, () => {
    if (config.nodeEnv === 'development') {
        console.log(`Server is running on port ${config.port} in ${config.nodeEnv} mode`);
        console.log(`Running at http://${config.host}:${config.port}`);
    }
    if (config.nodeEnv === 'production') {
        console.log(`Server is running on port ${config.port} in ${config.nodeEnv} mode`);
        console.log(`Running at https://${config.host}:${config.port}`);
    }
})
// Fixed Prisma configuration with proper error handling
const prisma = new PrismaClient({
    datasources: {
        db: {
            // Use DATABASE_URL instead of LOCAL_DATABASE_URL for better compatibility
            url: process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty'
});

// Test database connection on startup
prisma.$connect()
    .then(() => {
        console.log('✅ Database connected successfully');
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error);
    });
    