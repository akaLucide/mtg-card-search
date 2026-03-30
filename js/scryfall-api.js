/**
 * Fetches all printings of a card from the Scryfall API.
 * @param {string} cardName
 * @returns {Promise<Array>} Array of Scryfall card objects
 */
async function getCardPrintings(cardName) {
  try {
    const response = await fetch(
      `${SCRYFALL_API_BASE}/cards/search?q=!"${encodeURIComponent(cardName)}"&unique=prints`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching printings for ${cardName}:`, error);
    return [];
  }
}

/**
 * Searches for a card by name using Scryfall's fuzzy matching.
 * @param {string} cardName
 * @returns {Promise<Object|null>} Card object or null if not found
 */
async function searchCardByName(cardName) {
  try {
    const response = await fetch(
      `${SCRYFALL_API_BASE}/cards/named?fuzzy=${encodeURIComponent(cardName)}`
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error("Failed to search for card");
    }
    return await response.json();
  } catch (error) {
    console.error(`Error searching for card ${cardName}:`, error);
    return null;
  }
}

/**
 * Fetches autocomplete suggestions for a partial card name query.
 * @param {string} query - Partial card name
 * @returns {Promise<Array>} Array of card name strings
 */
async function getAutocompleteSuggestions(query) {
  try {
    const response = await fetch(
      `${SCRYFALL_API_BASE}/cards/autocomplete?q=${encodeURIComponent(query)}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Autocomplete error:", error);
    return [];
  }
}
