import express from 'express';
import config from "config";
import {getLogger} from "./logger";

const app: express.Application = express();
const port = config.get<number>('server.port');


const logger = getLogger()

// Handling '/' Request
app.get('/ping', (_req, _res) => {
    // log current timestamp
    logger.info({headers: _req.headers}, `ping: ${Date.now()}`);
    _res.send("TypeScript With Express");
});

// Server setup
app.listen(port, () => {
    console.log(`TypeScript with Express http://localhost:${port}/`);
});
