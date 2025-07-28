import app from "./app";
import config from "../code/config/config";

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