/* eslint-disable no-console */
function write(level, message, meta) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...(meta && typeof meta === "object" ? { meta } : { meta: meta ?? null })
    };
    console.log(JSON.stringify(payload));
}
export const logger = {
    info: (message, meta) => {
        write("INFO", message, meta);
    },
    warn: (message, meta) => {
        write("WARN", message, meta);
    },
    error: (message, meta) => {
        write("ERROR", message, meta);
    }
};
//# sourceMappingURL=logger.js.map