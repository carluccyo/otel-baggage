import pino, {LoggerOptions} from "pino";
import Logger = pino.Logger;
import {config} from "dotenv";


const getLoggerOptions = (logConfig): LoggerOptions => {
    const loggerOptions: LoggerOptions = {
        enabled: logConfig.enabled,
        level: logConfig.level,
        formatters: {
            level: (label) => {
                return { level: label.toUpperCase() };
            },
        },
    };
    if (!logConfig.enabled) {
        return loggerOptions;
    }
    return loggerOptions;
};

let logger;
export const getLogger = (_module = ''): Logger => {
    if (!logger) {
        logger = pino({});
    }
    return logger;
};
