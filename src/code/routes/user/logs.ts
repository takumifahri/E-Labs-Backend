import { Router } from "express";
import { createLog, getLogs } from "../../controller/api/user/LogController";

const LogRouter = Router();

LogRouter.post("/", createLog);
LogRouter.get("/", getLogs);

export default LogRouter;