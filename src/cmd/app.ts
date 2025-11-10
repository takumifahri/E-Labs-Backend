import express from "express"
import router from "../code/routes/router";
import corsOptions from "../code/config/cors";
import cors from "cors";
import { logger } from "../code/utils/logger";
import multer from 'multer';
import { errorHandler, notFound } from "../code/middleware/error";
import path from "node:path";
import { error } from "node:console";
import cookieParser from "cookie-parser";
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions))

app.use('/storage', express.static(path.join(process.cwd(), 'src', 'code', 'storage')));

// Logger middleware untuk debug
// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.path}`);
//     next();
// });

// Test endpoint untuk cek static files
app.get('/test-static', (req, res) => {
    const storagePath = path.join(process.cwd(), 'src', 'code', 'storage');
    res.json({
        storagePath,
        exists: require('fs').existsSync(storagePath)
    });
});

// Logger middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});
// Middleware untuk parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Index routes
app.use('/api', router);
app.get('/', (req, res) => {
    res.send('Welcome to the API');
});
    
// Error handling
app.use(notFound);
app.use(errorHandler);
export default app;
