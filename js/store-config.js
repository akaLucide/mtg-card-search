/**
 * Centralized store configuration.
 *
 * Each entry contains store metadata and two URL builder methods:
 *   - buildDirectUrl: the public product page URL on the store's website
 *   - buildApiUrl: the internal proxy URL used to fetch the scraped price
 *
 * Both methods accept the same params object so that callers never need
 * to branch on store keys — add a new store here and it works everywhere.
 */

/**
 * Normalizes the frame effect and promo flags into URL-ready segments.
 * @param {string} storeKey
 * @param {string|null} frameEffect
 * @param {boolean} isPromo
 * @param {string} separator - "-" for direct URLs, "/" for API URLs
 * @returns {{ effectPart: string, promoPart: string }}
 */
function _buildUrlParts(storeKey, frameEffect, isPromo, separator) {
  const normalizedEffect = frameEffect
    ? normalizeFrameEffect(frameEffect, storeKey)
    : null;
  const effectPart = normalizedEffect ? `${normalizedEffect}${separator}` : "";
  const promoPart = isPromo ? `promo-pack${separator}` : "";
  return { effectPart, promoPart };
}

const STORE_CONFIG = {
  f2f: {
    name: "Face to Face Games",
    key: "f2f",
    emoji: "🛡️",
    shortName: "F2F",

    /** @param {{ cardSlug, collectorNumber, setSlug, frameEffect, isPromo }} params */
    buildDirectUrl({ cardSlug, collectorNumber, setSlug, frameEffect, isPromo }) {
      const { effectPart, promoPart } = _buildUrlParts("f2f", frameEffect, isPromo, "-");
      return `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${promoPart}${effectPart}${setSlug}-non-foil`;
    },

    /** @param {{ cardSlug, collectorNumber, setSlug, frameEffect, isPromo }} params */
    buildApiUrl({ cardSlug, collectorNumber, setSlug, frameEffect, isPromo }) {
      const { effectPart, promoPart } = _buildUrlParts("f2f", frameEffect, isPromo, "/");
      return `${API_BASE}/price/f2f/${cardSlug}/${collectorNumber}/${promoPart}${effectPart}${setSlug}`;
    },
  },

  hoc: {
    name: "House of Cards",
    key: "hoc",
    emoji: "🃏",
    shortName: "HOC",

    /** @param {{ cardSlug, setSlug, frameEffect, isPromo }} params */
    buildDirectUrl({ cardSlug, setSlug, frameEffect, isPromo }) {
      const { effectPart, promoPart } = _buildUrlParts("hoc", frameEffect, isPromo, "-");
      return `https://houseofcards.ca/products/${cardSlug}-${promoPart}${effectPart}${setSlug}`;
    },

    /** @param {{ cardSlug, setSlug, frameEffect, isPromo }} params */
    buildApiUrl({ cardSlug, setSlug, frameEffect, isPromo }) {
      const { effectPart, promoPart } = _buildUrlParts("hoc", frameEffect, isPromo, "/");
      return `${API_BASE}/price/hoc/${cardSlug}/${promoPart}${effectPart}${setSlug}`;
    },
  },

  "401games": {
    name: "401 Games",
    key: "401games",
    emoji: "🎲",
    shortName: "401",

    /** @param {{ cardSlug, setCode, frameEffect, isPromo }} params */
    buildDirectUrl({ cardSlug, setCode, frameEffect, isPromo }) {
      const { effectPart, promoPart } = _buildUrlParts("401games", frameEffect, isPromo, "-");
      return `https://store.401games.ca/products/${cardSlug}-${promoPart}${effectPart}${setCode}`;
    },

    /** @param {{ cardSlug, setCode, frameEffect, isPromo }} params */
    buildApiUrl({ cardSlug, setCode, frameEffect, isPromo }) {
      const { effectPart, promoPart } = _buildUrlParts("401games", frameEffect, isPromo, "/");
      return `${API_BASE}/price/401games/${cardSlug}/${promoPart}${effectPart}${setCode}`;
    },
  },
};

/**
 * @returns {string[]} Array of all registered store keys
 */
function getStoreKeys() {
  return Object.keys(STORE_CONFIG);
}

/**
 * @param {string} storeKey
 * @returns {string} The store's full display name
 */
function formatStoreName(storeKey) {
  const config = STORE_CONFIG[storeKey];
  return config ? config.name : storeKey;
}

/**
 * @param {string} storeKey
 * @returns {string} The store's emoji icon
 */
function getStoreEmoji(storeKey) {
  const config = STORE_CONFIG[storeKey];
  return config ? config.emoji : "";
}

/**
 * @param {string} storeKey
 * @returns {string} The store's abbreviated name (e.g. "F2F", "HOC", "401")
 */
function getStoreShortName(storeKey) {
  const config = STORE_CONFIG[storeKey];
  return config ? config.shortName : storeKey;
}
