import app from "./app";
import config from "../code/config/config";

app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`Running at http://${config.host}:${config.port}`);
})