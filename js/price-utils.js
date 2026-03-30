/**
 * Formats a USD price as a CAD string.
 * @param {number|string} usdPrice
 * @param {number} exchangeRate - USD to CAD rate
 * @returns {string|null} Formatted price like "$1.35 CAD", or null if invalid
 */
function formatPriceCAD(usdPrice, exchangeRate = CARD_CONFIG.DEFAULT_USD_TO_CAD) {
  if (!usdPrice || parseFloat(usdPrice) <= 0) return null;
  const cadPrice = (parseFloat(usdPrice) * exchangeRate).toFixed(2);
  return `$${cadPrice} CAD`;
}

/**
 * Finds the cheapest printing from an array of Scryfall card objects.
 * Optionally excludes special frame effects and promo cards.
 * Falls back to the first printing when no USD price is available.
 * @param {Array} printings - Array of Scryfall card objects
 * @param {boolean} excludeSpecial - Whether to filter out special printings
 * @returns {Object|null} Cheapest card object or null
 */
function findCheapestPrinting(printings, excludeSpecial = false) {
  if (!printings || printings.length === 0) return null;

  const candidates = excludeSpecial
    ? printings.filter((card) => !hasSpecialFrameEffect(card))
    : printings;

  if (candidates.length === 0) return null;

  let cheapestCard = null;
  let lowestPrice = Infinity;

  for (const card of candidates) {
    if (card.prices && card.prices.usd) {
      const price = parseFloat(card.prices.usd);
      if (price > 0 && price < lowestPrice) {
        lowestPrice = price;
        cheapestCard = card;
      }
    }
  }

  return cheapestCard || candidates[0];
}

/**
 * Sorts printings by USD price ascending.
 * Cards without a USD price are placed at the end.
 * @param {Array} printings - Array of Scryfall card objects
 * @returns {Array} New sorted array
 */
function sortPrintingsByPrice(printings) {
  return [...printings].sort((a, b) => {
    const priceA = a.prices?.usd ? parseFloat(a.prices.usd) : Infinity;
    const priceB = b.prices?.usd ? parseFloat(b.prices.usd) : Infinity;
    return priceA - priceB;
  });
}

/**
 * Parses a raw deck list string into structured card entries.
 * Supports formats: "4x Lightning Bolt", "4 Lightning Bolt", "Lightning Bolt".
 * @param {string} deckText - Raw deck list text
 * @returns {Array<{quantity: number, name: string}>}
 */
function parseDeckList(deckText) {
  const cards = [];

  for (const line of deckText.trim().split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+)x?\s+(.+)$/i);
    if (match) {
      cards.push({ quantity: parseInt(match[1]), name: match[2].trim() });
    } else {
      cards.push({ quantity: 1, name: trimmed });
    }
  }

  return cards;
}

/**
 * Returns the best available card image URL from a Scryfall card object.
 * Handles both single-faced and double-faced cards.
 * @param {Object} card - Scryfall card object
 * @returns {string|null}
 */
function getCardImageUrl(card) {
  if (!card) return null;
  return (
    card.image_uris?.normal ||
    card.image_uris?.large ||
    card.image_uris?.png ||
    card.card_faces?.[0]?.image_uris?.normal ||
    null
  );
}
