const short = {
    el: (s) => document.querySelector(s),
    classAdd: (c) => short.el("div.left-container").classList.add(c),
    classRemove: (c) => short.el("div.left-container").classList.remove(c),
    flattenAndUnique: (arr) => [...new Set([].concat.apply([], arr))],
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

class DefaultInfluencer extends Influencer {
    constructor({ suggestionDefaults }) {
        super(...arguments);
        this._suggestionDefaults = suggestionDefaults;
    }

    getSuggestions({ raw }) {
        return new Promise((resolve) =>
            resolve((this._suggestionDefaults[raw] || []).slice(0, this._limit))
        );
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
            script.src = `https://duckduckgo.com/ac/?callback=autocompleteCallback&q=${query}`;
            short.el("head").appendChild(script);
        });
    }
}

class HistoryInfluencer extends Influencer {
    constructor() {
        super(...arguments);
        this._storeName = "history";
    }

    addItem({ isPath, lower }) {
        if (isPath || this._isTooShort(lower)) return;
        let exists;

        const history = this._getHistory().map(([item, count]) => {
            const match = item === lower;
            if (match) exists = true;
            return [item, match ? count + 1 : count];
        });

        if (!exists) history.push([lower, 1]);
        this._setHistory(history.sort((a, b) => b[1] - a[1]));
    }

    getSuggestions(parsedQuery) {
        const { lower } = parsedQuery;
        if (this._isTooShort(lower)) return Promise.resolve([]);

        return new Promise((resolve) =>
            resolve(
                this._addSearchPrefix(
                    this._getHistory()
                        .filter(
                            ([item]) => item !== lower && item.includes(lower)
                        )
                        .slice(0, this._limit)
                        .map(([item]) => item),
                    parsedQuery
                )
            )
        );
    }

    _getHistory() {
        this._history =
            this._history ||
            JSON.parse(localStorage.getItem(this._storeName)) ||
            [];

        return this._history;
    }

    _setHistory(history) {
        this._history = history;
        localStorage.setItem(this._storeName, JSON.stringify(history));
    }
}

class Suggester {
    constructor(options) {
        this.searchEl = short.el("#search-suggestions");

        this.influencers = options.influencers;
        this.limit = options.limit;
        this.parsedQuery = "";
        this.setSuggestions = this.setSuggestions.bind(this);
        this.buildSuggestions = this.buildSuggestions.bind(this);
    }

    suggest(parsedQuery) {
        this.parsedQuery = parsedQuery;

        if (!parsedQuery.query) {
            this.removeSuggestions();
            return;
        }

        Promise.all(this.getInfluencers()).then(this.setSuggestions);
    }

    buildSuggestions(suggestions) {
        return suggestions.slice(0, this.limit).reduce((acc, suggestion) => {
            const suggestionHtml = `<span class="search-suggestion-match">${suggestion}</span>`;
            return `
        ${acc}
        <li>
        <button
          type="button"
          class="search-suggestion"
          data-suggestion="${suggestion}"
          tabindex="-1"
        >
          ${suggestionHtml}
        </button>
      </li>
        `;
        }, "");
    }

    setSuggestions(newSuggestions) {
        const suggestions = short.flattenAndUnique(newSuggestions);
        this.searchEl.innerHTML = this.buildSuggestions(suggestions);
        short.classAdd("suggestions");
    }

    getInfluencers() {
        return this.influencers.map((inf) =>
            inf.getSuggestions(this.parsedQuery)
        );
    }

    removeSuggestions() {
        this.searchEl.innerHTML = "";
    }
}

class QueryParser {
    constructor(options) {
        this.commands = options.commands;
        this.searchDelimiter = options.searchDelimiter;
        this.pathDelimiter = options.pathDelimiter;
        this.scripts = options.scripts;
        this.protocolRegex = /^[a-zA-Z]+:\/\//i;
        this.urlRegex =
            /^((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)$/i;
        this.parse = this.parse.bind(this);
    }
    parse(query) {
        const res = [];
        res.raw = query.trim();
        res.query = res.raw;
        res.lower = res.raw.toLowerCase();
        res.split = null;

        if (this.urlRegex.test(query)) {
            const hasProtocol = this.protocolRegex.test(query);
            res.redirect = hasProtocol ? query : "http://" + query;
            return res;
        }

        const splitSearch = res.query.split(this.searchDelimiter);
        const splitPath = res.query.split(this.pathDelimiter);

        const isScript = Object.entries(this.scripts).some(([key, script]) => {
            if (query === key) {
                res.key = key;
                res.isKey = true;
                script.forEach((command) => res.push(this.parse(command)));
                return true;
            }

            if (splitSearch[0] === key) {
                res.key = key;
                res.isSearch = true;
                res.split = this.searchDelimiter;
                res.query = QueryParser._shiftAndTrim(splitSearch, res.split);
                res.lower = res.query.toLowerCase();

                script.forEach((command) =>
                    res.push(this.parse(`${command}${res.split}${res.query}`))
                );

                return true;
            }

            if (splitPath[0] === key) {
                res.key = key;
                res.isPath = true;
                res.split = this.pathDelimiter;
                res.path = QueryParser._shiftAndTrim(splitPath, res.split);

                script.forEach((command) =>
                    res.push(
                        this.parse(
                            `${command}${this._pathDelimiter}${res.path}`
                        )
                    )
                );

                return true;
            }
        });

        if (isScript) return res;

        this.commands.some(({ key, search, url }) => {
            if (query === key) {
                res.key = key;
                res.isKey = true;
                res.redirect = url;
                return true;
            }

            if (splitSearch[0] === key) {
                res.key = key;
                res.isSearch = true;
                res.split = this.searchDelimiter;
                res.query = QueryParser._shiftAndTrim(splitSearch, res.split);
                res.lower = res.query.toLowerCase();
                res.redirect = QueryParser._prepSearch(url, search, res.query);
                return true;
            }

            if (splitPath[0] === key) {
                res.key = key;
                res.isPath = true;
                res.split = this.pathDelimiter;
                res.path = QueryParser._shiftAndTrim(splitPath, res.split);
                res.redirect = QueryParser._prepPath(url, res.path);
                return true;
            }

            if (key === "*") {
                res.redirect = QueryParser._prepSearch(url, search, query);
            }
        });
        return res;
    }

    static _prepPath(url, path) {
        return QueryParser._stripUrlPath(url) + "/" + path;
    }

    static _prepSearch(url, searchPath, query) {
        if (!searchPath) return url;
        const baseUrl = QueryParser._stripUrlPath(url);
        const urlQuery = encodeURIComponent(query);
        searchPath = searchPath.replace(/{}/g, urlQuery);
        return baseUrl + searchPath;
    }

    static _shiftAndTrim(arr, delimiter) {
        arr.shift();
        return arr.join(delimiter).trim();
    }

    static _stripUrlPath(url) {
        const parser = document.createElement("a");
        parser.href = url;
        return `${parser.protocol}//${parser.hostname}`;
    }
}

class Form {
    constructor(options) {
        this.formEl = short.el("#search-form");
        this.inputEl = short.el("#search-input");
        this.inputElValue = "";
        this.newTab = options.newTab;
        this.instantRedirect = options.instantRedirect;
        this.suggester = options.suggester;
        this.parseQuery = options.parseQuery;
        this.handleInput = this.handeInput.bind(this);
        this.registerEvent();
    }

    hide() {
        short.classRemove("suggestions");
        this.inputEl.value = "";
        this.inputElValue = "";
        suggester.removeSuggestions();
    }
    handeInput() {
        const newQuery = this.inputEl.value;
        const parsedQuery = this.parseQuery(newQuery);
        if (!newQuery) {
            this.hide();
        } else {
            this.suggester.suggest(parsedQuery);
            // this.suggester.setSuggestions(parsedQuery["redirect"]);
        }
    }

    registerEvent() {
        this.inputEl.addEventListener("input", this.handleInput);
    }
}

const queryParser = new QueryParser({
    commands: CONFIG.commands,
    pathDelimiter: CONFIG.queryPathDelimiter,
    scripts: CONFIG.scripts,
    searchDelimiter: CONFIG.querySearchDelimiter,
});

const influencers = CONFIG.suggestionInfluencers.map((influencerConfig) => {
    return new {
        Default: DefaultInfluencer,
        DuckDuckGo: DuckDuckGoInfluencer,
        History: HistoryInfluencer,
    }[influencerConfig.name]({
        limit: influencerConfig.limit,
        minChars: influencerConfig.minChars,
        suggestionDefaults: CONFIG.suggestionDefaults,
    });
});

const suggester = new Suggester({
    influencers,
    limit: CONFIG.suggestionLimit,
});

const form = new Form({
    newTab: CONFIG.queryNewTab,
    instantRedirect: CONFIG.queryInstantRedirect,
    suggester,
    parseQuery: queryParser.parse,
});
