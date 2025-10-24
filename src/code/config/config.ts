import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: Number;
    nodeEnv: string;
    host: string;
}

const config: Config = {
    port: Number(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    host: process.env.DB_HOST || 'localhost'
}

export default config;