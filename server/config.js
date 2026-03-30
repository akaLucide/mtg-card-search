/** Server configuration constants */
const SERVER_CONFIG = {
  PORT: 3000,
  /** Timeout in ms — kept low to fail fast on rate-limited stores */
  REQUEST_TIMEOUT_MS: 8000,
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

module.exports = SERVER_CONFIG;
