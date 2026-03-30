/**
 * AutocompleteController manages all state and behaviour for the card name
 * autocomplete dropdown. Extracted from script.js to satisfy SRP — the main
 * script should only orchestrate card search, not own autocomplete internals.
 *
 * Usage:
 *   AutocompleteController.init(inputEl, listEl, onCommit);
 */
const AutocompleteController = {
  /** @type {HTMLInputElement} */
  inputEl: null,
  /** @type {HTMLElement} */
  listEl: null,
  /** @type {Function} Callback invoked when the user commits a selection */
  onCommit: null,
  /** @type {number|null} */
  debounceTimer: null,
  currentFocus: -1,

  /**
   * Attaches the controller to DOM elements and wires up all event listeners.
   * @param {HTMLInputElement} inputEl
   * @param {HTMLElement} listEl
   * @param {Function} onCommit - Called with no arguments when user selects or presses Enter
   */
  init(inputEl, listEl, onCommit) {
    this.inputEl = inputEl;
    this.listEl = listEl;
    this.onCommit = onCommit;
    this._attachListeners();
  },

  _attachListeners() {
    this.inputEl.addEventListener("input", () => this._handleInput());
    this.inputEl.addEventListener("keydown", (e) => this._handleKeydown(e));
    document.addEventListener("click", (e) => {
      if (e.target !== this.inputEl) this.close();
    });
  },

  async _handleInput() {
    const query = this.inputEl.value.trim();
    clearTimeout(this.debounceTimer);

    if (query.length < 2) {
      this.close();
      return;
    }

    this.debounceTimer = setTimeout(async () => {
      const suggestions = await getAutocompleteSuggestions(query);
      this.display(suggestions);
    }, AUTOCOMPLETE_DELAY_MS);
  },

  _handleKeydown(e) {
    const items = this.listEl.getElementsByClassName("autocomplete-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.currentFocus++;
      this._setActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.currentFocus--;
      this._setActive(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this.currentFocus > -1 && items[this.currentFocus]) {
        items[this.currentFocus].click();
      } else {
        this.onCommit();
      }
    } else if (e.key === "Escape") {
      this.close();
    }
  },

  /**
   * Renders the suggestion list with the matched text highlighted.
   * @param {string[]} suggestions
   */
  display(suggestions) {
    this.close();
    if (!suggestions || suggestions.length === 0) return;

    this.currentFocus = -1;
    const query = this.inputEl.value.trim();

    suggestions.forEach((suggestion) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";

      const index = suggestion.toLowerCase().indexOf(query.toLowerCase());
      if (index !== -1) {
        item.innerHTML =
          suggestion.substr(0, index) +
          "<strong>" +
          suggestion.substr(index, query.length) +
          "</strong>" +
          suggestion.substr(index + query.length);
      } else {
        item.textContent = suggestion;
      }

      item.addEventListener("click", () => {
        this.inputEl.value = suggestion;
        this.close();
        this.onCommit();
      });

      this.listEl.appendChild(item);
    });

    this.listEl.classList.add("show");
  },

  /**
   * Highlights the item at currentFocus, with wrap-around behaviour.
   * @param {HTMLCollection} items
   */
  _setActive(items) {
    if (!items || items.length === 0) return;
    Array.from(items).forEach((item) => item.classList.remove("active"));

    if (this.currentFocus >= items.length) this.currentFocus = 0;
    if (this.currentFocus < 0) this.currentFocus = items.length - 1;

    items[this.currentFocus].classList.add("active");
    items[this.currentFocus].scrollIntoView({ block: "nearest" });
  },

  /** Clears and hides the dropdown */
  close() {
    this.listEl.innerHTML = "";
    this.listEl.classList.remove("show");
    this.currentFocus = -1;
  },
};
