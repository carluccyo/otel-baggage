module.exports = {
    env: process.env.NODE_ENV,
    server: {
        port: process.env.PORT || 4000,
    },
    ping: {
        enabled: process.env.PING_ENABLED ? process.env.PING_ENABLED === 'true' : false,
        target_service_url: process.env.TARGET_SERVICE_URL,
    },
};
