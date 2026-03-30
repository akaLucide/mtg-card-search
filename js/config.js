/** Internal proxy server base URL */
const API_BASE = "http://localhost:3000/api";

/** Scryfall public API base URL */
const SCRYFALL_API_BASE = "https://api.scryfall.com";

/** Exchange rate API used to convert USD prices to CAD */
const EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";

/** Shared card processing configuration */
const CARD_CONFIG = {
  DEFAULT_USD_TO_CAD: 1.35,
};

/** Milliseconds to wait between autocomplete keystrokes before firing the API request */
const AUTOCOMPLETE_DELAY_MS = 25;

/** Milliseconds to wait between each card evaluation to avoid rate-limiting the stores */
const DECK_EVAL_DELAY_MS = 100;
