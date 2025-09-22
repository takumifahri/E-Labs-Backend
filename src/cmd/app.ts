import express from "express"
import router from "../code/routes/router";
import corsOptions from "../code/config/cors";
import cors from "cors";
import { logger } from "../code/utils/logger";

import { errorHandler, notFound } from "../code/middleware/error";
const app = express();
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Index routes
app.use(cors(corsOptions))
app.use('/api', router);
app.get('/', (req, res) => {
    res.send('Welcome to the API');
});
// Error handling
app.use(notFound);
app.use(errorHandler);
export default app;