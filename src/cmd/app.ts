import express from "express"
import router from "../code/routes/router";
import corsOptions from "../code/config/cors";
import cors from "cors";
import { logger } from "../code/utils/logger";
import multer from 'multer';
import { errorHandler, notFound } from "../code/middleware/error";
import path from "node:path/win32";
const app = express();
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});
// Middleware untuk parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Index routes
app.use(cors(corsOptions))
app.use('/api', router);
app.get('/', (req, res) => {
    res.send('Welcome to the API');
});
// Static files
app.use('/storage', express.static(path.join(process.cwd(), 'src', 'code', 'storage')));
    
// Error handling
app.use(notFound);
app.use(errorHandler);
export default app;