import express from "express"
import router from "../code/routes/router";
import corsOptions from "../code/config/cors";
import cors from "cors";
const app = express();
app.use(express.json());


// Index routes
app.use(cors(corsOptions))
app.use('/api', router);

export default app;