const pino = require("pino");

// One shared logger for the whole app. Every line is a JSON object
// ({ level, time, msg, ...fields }), so logs can be searched by field.
// Jest sets NODE_ENV=test - stay silent there so test output stays clean.
// Readable output in dev: docker compose logs -f --no-log-prefix api | npx pino-pretty -c
//
// The "level" field in each JSON line is a number:
//   10 = trace   very detailed, step by step
//   20 = debug   details for finding bugs (hidden at the default "info" level)
//   30 = info    normal events: server started, push sent
//   40 = warn    something is off but handled: 4xx, rate limit hit
//   50 = error   something failed: 500, startup error
//   60 = fatal   the app cannot continue
// LOG_LEVEL shows that level and everything above it (info → 30, 40, 50, 60).
const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : process.env.LOG_LEVEL || "info",
});

module.exports = logger;
