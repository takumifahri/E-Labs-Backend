import express from "express"
import router from "../code/routes/router";
const app = express();
app.use(express.json());


// Index routes

app.use('/api', router);

export default app;