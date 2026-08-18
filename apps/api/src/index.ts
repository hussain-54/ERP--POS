import "./lib/node-websocket.js";
import { createApp } from "./app.js";
import { assertProductionConfig, config } from "./config.js";
import { log } from "./lib/logger.js";

assertProductionConfig();

const app = createApp();

app.listen(config.port, () => {
  log.info({
    category: "application",
    message: "API listening",
    meta: { port: config.port, env: config.nodeEnv, appEnv: config.appEnv },
  });
});
