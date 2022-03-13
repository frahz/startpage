const short = {
    el: (s) => document.querySelector(s),
    classAdd: (c) => short.el("div.left-container").classList.add(c),
    classRemove: (c) => short.el("div.left-container").classList.remove(c),
};

class Influencer {
    constructor(options) {
        this._limit = options.limit;
        this._minChars = options.minChars;
    }

    addItem() {
        return undefined;
    }

    getSuggestions() {
        return Promise.resolve([]);
    }

    _addSearchPrefix(items, { isSearch, key, split }) {
        const searchPrefix = isSearch ? `${key}${split}` : false;
        return items.map((s) => (searchPrefix ? searchPrefix + s : s));
    }

    _isTooShort(query) {
        return query.length < this._minChars;
    }
}

class DuckDuckGoInfluencer extends Influencer {
    constructor() {
        super(...arguments);
    }

    getSuggestions(parsedQuery) {
        const { lower, query } = parsedQuery;
        if (this._isTooShort(query)) return Promise.resolve([]);

        return new Promise((resolve) => {
            window.autocompleteCallback = (res) =>
                resolve(
                    this._addSearchPrefix(
                        res
                            .map((i) => i.phrase)
                            .filter((s) => s.toLowerCase() !== lower)
                            .slice(0, this._limit),
                        parsedQuery
                    )
                );

            const script = document.createElement("script");
            script.src = `https://duckduckgo.com/ac/?callback=autocompleteCallback&q=short{query}`;
            short.el("head").appendChild(script);
        });
    }
}

class Suggestor {
    constructor(options) {
        this.limit = options.limit;
        this.el = short.el("#search-suggestions");
        this.formEl = short.el("#search-form");
        this.inputEl = short.el("#search-input");
        this.handleInput = this.handeInput.bind(this);
        this.registerEvent();
    }

    handeInput() {
        const newQuery = this.inputEl.value;
        if (!newQuery) {
            short.classRemove("suggestions");
            this.el.innerHTML = "";
        } else {
            const acc = "";
            const suggestionHtml = `<span class="search-suggestion-match">${newQuery}</span>`;
            const suggestions = `
            ${acc}
            <li>
            <button
              type="button"
              class="search-suggestion"
              data-suggestion="${newQuery}"
              tabindex="-1"
            >
              ${suggestionHtml}
            </button>
          </li>
            `;
            short.classAdd("suggestions");
            this.el.innerHTML = suggestions.repeat(this.limit);
        }
    }

    registerEvent() {
        this.inputEl.addEventListener("input", this.handleInput);
    }
}

const suggestor = new Suggestor({
    limit: CONFIG.suggestionLimit,
});
