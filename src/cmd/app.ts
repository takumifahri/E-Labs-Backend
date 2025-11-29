import express from "express";
import router from "../code/routes/router";
import corsOptions from "../code/config/cors";
import cors from "cors";
import { logger } from "../code/utils/logger";
import { errorHandler, notFound } from "../code/middleware/error";
import path from "node:path";
import cookieParser from "cookie-parser";
import { initAllSchedulers } from "../code/utils/scheduler";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from "../code/config/swagger";

// fs diperlukan untuk pengecekan debug
import fs from 'fs'; 


console.log("---------------------------------------------------");
console.log("🔌 DATABASE URL YG DIPAKAI:", process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL);
console.log("---------------------------------------------------");

const app = express();
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use('/storage', express.static(path.join(process.cwd(), 'src', 'code', 'storage')));

if (process.env.NODE_ENV === 'development') {
    // ✅ Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'E-Labs+ API Docs'
    }));

    // ✅ Swagger JSON
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
}

// ... Middleware Logger & Scheduler ...
initAllSchedulers();

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Middleware Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', router);
app.get('/', (req, res) => {
    res.send('Welcome to the API');
});

// Error handling
app.use(notFound);
app.use(errorHandler);



export default app;