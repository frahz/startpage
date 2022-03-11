const CONFIG = {
    /**
     * Instantly redirect when a key is matched. Put a space before any other
     * queries to prevent unwanted redirects.
     */
    queryInstantRedirect: false,

    /**
     * Open triggered queries in a new tab.
     */
    queryNewTab: true,

    /**
     * The delimiter between a command key and a path. For example, you'd type
     * "r/r/unixporn" to go to "https://reddit.com/r/unixporn".
     */
    queryPathDelimiter: '/',

    /**
     * The delimiter between a command key and your search query. For example,
     * to search GitHub for tilde, you'd type "g'tilde".
     */
    querySearchDelimiter: "'",

    /**
     * Scripts allow you to open or search multiple sites at once. For example,
     * to search Google, Bing, DuckDuckGo, Ecosia and Yahoo for cats at the same
     * time, you'd type "q'cats".
     */
    scripts: {
        q: ['bin', 'yah', 'eco', 'ddg', '*'],
    },

    /**
     * The order, limit and minimum characters for each suggestion influencer.
     *
     * An "influencer" is just a suggestion source. "limit" is the max number of
     * suggestions an influencer will produce. "minChars" determines how many
     * characters need to be typed before the influencer kicks in.
     *
     * The following influencers are available:
     *
     * - "Default" suggestions come from CONFIG.suggestionDefaults (sync)
     * - "History" suggestions come from your previously entered queries (sync)
     * - "DuckDuckGo" suggestions come from the DuckDuckGo search API (async)
     *
     * To disable suggestions, remove all influencers.
     */
    suggestionInfluencers: [
        { name: 'Default', limit: 4 },
        { name: 'History', limit: 4, minChars: 2 },
        { name: 'DuckDuckGo', limit: 4, minChars: 2 },
    ],

    /**
     * Max number of suggestions that will ever be shown.
     */
    suggestionLimit: 4,

    /**
     * The name, key, url, search path and color for your commands. If none of
     * the specified keys are matched, the * key is used. Commands without a
     * name don't show up in the help menu.
     *
     * "hues" is an array of HSL hues that will be converted into a linear
     * gradient. CSS variables defined below, prefixed with --command-color-,
     * determine the saturation and lightness for each generated color.
     *
     * "color", if defined, will be applied to the command as-is.
     */
    commands: [
        {
            key: '*',
            search: '/search?q={}',
            url: 'https://www.google.com',
        },
        {
            key: 'bin',
            search: '/search?q={}',
            url: 'https://www.bing.com',
        },
        {
            key: 'ddg',
            search: '/?q={}',
            url: 'https://duckduckgo.com',
        },
        {
            key: 'eco',
            search: '/search?q={}',
            url: 'https://www.ecosia.org',
        },
        {
            key: 'yah',
            search: '/search?p={}',
            url: 'https://search.yahoo.com',
        }
    ]

}

const $ = {
    bodyClassAdd: (c) => $.el('body').classList.add(c),
    bodyClassRemove: (c) => $.el('body').classList.remove(c),
    el: (s) => document.querySelector(s),
    els: (s) => [].slice.call(document.querySelectorAll(s) || []),
    escapeRegex: (s) => s?.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'),
    flattenAndUnique: (arr) => [...new Set([].concat.apply([], arr))],
    isDown: (e) => ['ctrl-n', 'down', 'tab'].includes($.whichKey(e)),
    isRemove: (e) => ['backspace', 'delete'].includes($.whichKey(e)),
    isUp: (e) => ['ctrl-p', 'up', 's-tab'].includes($.whichKey(e)),
    whichKey: (e) => {
        const ctrl = e.ctrlKey;
        const meta = e.metaKey;
        const shift = e.shiftKey;

        switch (e.which) {
            case 8:
                return 'backspace';
            case 9:
                return shift ? 's-tab' : 'tab';
            case 13:
                return 'enter';
            case 16:
                return 'shift';
            case 17:
                return 'ctrl';
            case 18:
                return 'alt';
            case 27:
                return 'escape';
            case 38:
                return 'up';
            case 40:
                return 'down';
            case 46:
                return 'delete';
            case 78:
                return ctrl ? 'ctrl-n' : 'n';
            case 80:
                return ctrl ? 'ctrl-p' : 'p';
            case 86:
                if (ctrl) return 'ctrl-v';
                if (meta) return 'ctrl-v';
                break;
            case 91:
            case 93:
            case 224:
                return 'meta';
        }

        if (ctrl) return 'ctrl-*';
        if (meta) return 'meta-*';
    },
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

            const script = document.createElement('script');
            script.src = `https://duckduckgo.com/ac/?callback=autocompleteCallback&q=${query}`;
            $.el('head').appendChild(script);
        });
    }
}

class HistoryInfluencer extends Influencer {
    constructor() {
        super(...arguments);
        this._storeName = 'history';
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
                        .filter(([item]) => item !== lower && item.includes(lower))
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
        this._el = $.el('#search-suggestions');
        this._influencers = options.influencers;
        this._limit = options.limit;
        this._parsedQuery = '';
        this._highlightedSuggestion = null;
        this._suggestionEls = [];
        this._handleKeydown = this._handleKeydown.bind(this);
        this._setSuggestions = this._setSuggestions.bind(this);
        this._registerEvents();
    }

    setOnClick(callback) {
        this._onClick = callback;
    }

    setOnHighlight(callback) {
        this._onHighlight = callback;
    }

    setOnUnhighlight(callback) {
        this._onUnhighlight = callback;
    }

    success(parsedQuery) {
        this._influencers.forEach((i) => i.addItem(parsedQuery));
        this._clearSuggestions();
    }

    suggest(parsedQuery) {
        this._parsedQuery = parsedQuery;
        this._highlightedSuggestion = null;

        if (!parsedQuery.query) {
            this._clearSuggestions();
            return;
        }

        Promise.all(this._getInfluencers()).then(this._setSuggestions);
    }

    _buildSuggestionsHtml(suggestions) {
        return suggestions.slice(0, this._limit).reduce((acc, suggestion) => {
            const match = new RegExp($.escapeRegex(this._parsedQuery.query), 'i');
            const matched = suggestion.match(match);

            const suggestionHtml = matched
                ? suggestion.replace(
                    match,
                    `<span class="search-suggestion-match">${matched[0]}</span>`
                )
                : suggestion;

            return `
          ${acc}
          <li>
            <button
              type="button"
              class="js-search-suggestion search-suggestion"
              data-suggestion="${suggestion}"
              tabindex="-1"
            >
              ${suggestionHtml}
            </button>
          </li>
        `;
        }, '');
    }

    _clearSuggestionClickEvents() {
        this._suggestionEls.forEach((el) => {
            el.removeEventListener('click', this._onClick);
        });
    }

    _clearSuggestionHighlightEvents() {
        this._suggestionEls.forEach((el) => {
            el.removeEventListener('mouseover', this._highlight);
            el.removeEventListener('mouseout', this._unHighlight);
        });
    }

    _clearSuggestions() {
        $.bodyClassRemove('suggestions');
        this._clearSuggestionHighlightEvents();
        this._clearSuggestionClickEvents();
        this._el.innerHTML = '';
        this._highlightedSuggestion = null;
        this._suggestionEls = [];
    }

    _focusNext(e) {
        const exists = this._suggestionEls.some((el, i) => {
            if (el.classList.contains('highlight')) {
                this._highlight(this._suggestionEls[i + 1], e);
                return true;
            }
        });

        if (!exists) this._highlight(this._suggestionEls[0], e);
    }

    _focusPrevious(e) {
        const exists = this._suggestionEls.some((el, i) => {
            if (el.classList.contains('highlight') && i) {
                this._highlight(this._suggestionEls[i - 1], e);
                return true;
            }
        });

        if (!exists) this._unHighlight(e);
    }

    _getInfluencers() {
        return this._influencers.map((influencer) =>
            influencer.getSuggestions(this._parsedQuery)
        );
    }

    _handleKeydown(e) {
        if ($.isDown(e)) this._focusNext(e);
        if ($.isUp(e)) this._focusPrevious(e);
    }

    _highlight(el, e) {
        this._unHighlight();
        if (!el) return;
        this._highlightedSuggestion = el.getAttribute('data-suggestion');
        this._onHighlight(this._highlightedSuggestion);
        el.classList.add('highlight');
        if (e) e.preventDefault();
    }

    _registerEvents() {
        document.addEventListener('keydown', this._handleKeydown);
    }

    _registerSuggestionClickEvents() {
        this._suggestionEls.forEach((el) => {
            const value = el.getAttribute('data-suggestion');
            el.addEventListener('click', this._onClick.bind(null, value));
        });
    }

    _registerSuggestionHighlightEvents() {
        const noHighlightUntilMouseMove = () => {
            window.removeEventListener('mousemove', noHighlightUntilMouseMove);

            this._suggestionEls.forEach((el) => {
                el.addEventListener('mouseover', this._highlight.bind(this, el));
                el.addEventListener('mouseout', this._unHighlight.bind(this));
            });
        };

        window.addEventListener('mousemove', noHighlightUntilMouseMove);
    }

    _rehighlight() {
        if (!this._highlightedSuggestion) return;

        this._highlight(
            $.el(`[data-suggestion="${this._highlightedSuggestion}"]`)
        );
    }

    _setSuggestions(newSuggestions) {
        const suggestions = $.flattenAndUnique(newSuggestions);
        this._el.innerHTML = this._buildSuggestionsHtml(suggestions);
        this._suggestionEls = $.els('.js-search-suggestion');
        this._registerSuggestionHighlightEvents();
        this._registerSuggestionClickEvents();
        if (this._suggestionEls.length) $.bodyClassAdd('suggestions');
        this._rehighlight();
    }

    _unHighlight(e) {
        const el = $.el('.highlight');
        if (!el) return;
        this._onUnhighlight();
        el.classList.remove('highlight');
        if (e) e.preventDefault();
    }
}

class QueryParser {
    constructor(options) {
        this._commands = options.commands;
        this._searchDelimiter = options.searchDelimiter;
        this._pathDelimiter = options.pathDelimiter;
        this._scripts = options.scripts;
        this._protocolRegex = /^[a-zA-Z]+:\/\//i;
        this._urlRegex = /^((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)$/i;
        this.parse = this.parse.bind(this);
    }

    parse(query) {
        const res = [];
        res.raw = query.trim();
        res.query = res.raw;
        res.lower = res.raw.toLowerCase();
        res.split = null;

        if (this._urlRegex.test(query)) {
            const hasProtocol = this._protocolRegex.test(query);
            res.redirect = hasProtocol ? query : 'http://' + query;
            res.color = QueryParser._getColorFromUrl(this._commands, res.redirect);
            return res;
        }

        const splitSearch = res.query.split(this._searchDelimiter);
        const splitPath = res.query.split(this._pathDelimiter);

        const isScript = Object.entries(this._scripts).some(([key, script]) => {
            if (query === key) {
                res.key = key;
                res.isKey = true;
                script.forEach((command) => res.push(this.parse(command)));
                return true;
            }

            if (splitSearch[0] === key) {
                res.key = key;
                res.isSearch = true;
                res.split = this._searchDelimiter;
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
                res.split = this._pathDelimiter;
                res.path = QueryParser._shiftAndTrim(splitPath, res.split);

                script.forEach((command) =>
                    res.push(this.parse(`${command}${this._pathDelimiter}${res.path}`))
                );

                return true;
            }
        });

        if (isScript) return res;

        this._commands.some(({ key, search, url }) => {
            if (query === key) {
                res.key = key;
                res.isKey = true;
                res.redirect = url;
                return true;
            }

            if (splitSearch[0] === key) {
                res.key = key;
                res.isSearch = true;
                res.split = this._searchDelimiter;
                res.query = QueryParser._shiftAndTrim(splitSearch, res.split);
                res.lower = res.query.toLowerCase();
                res.redirect = QueryParser._prepSearch(url, search, res.query);
                return true;
            }

            if (splitPath[0] === key) {
                res.key = key;
                res.isPath = true;
                res.split = this._pathDelimiter;
                res.path = QueryParser._shiftAndTrim(splitPath, res.split);
                res.redirect = QueryParser._prepPath(url, res.path);
                return true;
            }

            if (key === '*') {
                res.redirect = QueryParser._prepSearch(url, search, query);
            }
        });

        res.color = QueryParser._getColorFromUrl(this._commands, res.redirect);
        return res;
    }

    static _getColorFromUrl(commands, url) {
        const domain = new URL(url).hostname;
        const domainRegex = new RegExp(`${domain}$`);

        return commands.find((c) => domainRegex.test(new URL(c.url).hostname))
            ?.color;
    }

    static _prepPath(url, path) {
        return QueryParser._stripUrlPath(url) + '/' + path;
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
        const parser = document.createElement('a');
        parser.href = url;
        return `${parser.protocol}//${parser.hostname}`;
    }
}

class Form {
    constructor(options) {
        this._formEl = $.el('#search-form');
        this._inputEl = $.el('#search-input');
        this._inputElVal = '';
        this._instantRedirect = options.instantRedirect;
        this._helpKey = options.helpKey;
        this._newTab = options.newTab;
        this._parseQuery = options.parseQuery;
        this._suggester = options.suggester;
        this._toggleHelp = options.toggleHelp;
        this._clearPreview = this._clearPreview.bind(this);
        this._handleInput = this._handleInput.bind(this);
        this._handleKeydown = this._handleKeydown.bind(this);
        this._previewValue = this._previewValue.bind(this);
        this._submitForm = this._submitForm.bind(this);
        this._submitWithValue = this._submitWithValue.bind(this);
        this.hide = this.hide.bind(this);
        this.show = this.show.bind(this);
        this._registerEvents();
        this._loadQueryParam();
    }

    hide() {
        $.bodyClassRemove('form');
        this._inputEl.value = '';
        this._inputElVal = '';
        this._suggester.suggest('');
        this._setColorsFromQuery('');
    }

    show() {
        $.bodyClassAdd('form');
        this._inputEl.focus();
    }

    _clearPreview() {
        this._previewValue(this._inputElVal);
        this._inputEl.focus();
    }

    _handleInput() {
        const newQuery = this._inputEl.value;
        const isHelp = newQuery === this._helpKey;
        const parsedQuery = this._parseQuery(newQuery);
        this._inputElVal = newQuery;
        this._suggester.suggest(parsedQuery);
        this._setColorsFromQuery(newQuery);

        if (!newQuery || isHelp) this.hide();
        if (isHelp) this._toggleHelp();

        if (this._instantRedirect && parsedQuery.isKey) {
            this._submitWithValue(newQuery);
        }
    }

    _handleKeydown(e) {
        if ($.isUp(e) || $.isDown(e) || $.isRemove(e)) return;

        switch ($.whichKey(e)) {
            case 'alt':
            case 'ctrl':
            case 'ctrl-*':
            case 'enter':
            case 'meta':
            case 'meta-*':
            case 'shift':
                return;
            case 'escape':
                this.hide();
                return;
        }

        this.show();
    }

    _loadQueryParam() {
        const q = new URLSearchParams(window.location.search).get('q');
        if (q) this._submitWithValue(q);
    }

    _previewValue(value) {
        this._inputEl.value = value;
        this._setColorsFromQuery(value);
    }

    _redirect(redirect, forceNewTab) {
        if (this._newTab || forceNewTab) {
            window.open(redirect, '_blank', 'noopener noreferrer');
        } else {
            window.location.href = redirect;
        }
    }

    _registerEvents() {
        document.addEventListener('keydown', this._handleKeydown);
        this._inputEl.addEventListener('input', this._handleInput);
        this._formEl.addEventListener('submit', this._submitForm, false);

        if (this._suggester) {
            this._suggester.setOnClick(this._submitWithValue);
            this._suggester.setOnHighlight(this._previewValue);
            this._suggester.setOnUnhighlight(this._clearPreview);
        }
    }

    _setColorsFromQuery(query) {
        const { color } = this._parseQuery(query);

        if (color) {
            this._formEl.style.background = color;
            $.bodyClassAdd('color');
        } else {
            this._formEl.style.background = '';
            $.bodyClassRemove('color');
        }
    }

    _submitForm(e) {
        if (e) e.preventDefault();
        const parsedQuery = this._parseQuery(this._inputEl.value);

        if (parsedQuery.length) {
            parsedQuery.forEach((r) => this._redirect(r.redirect, true));
        } else {
            this._redirect(parsedQuery.redirect);
        }

        this._suggester.success(parsedQuery);
        this.hide();
    }

    _submitWithValue(value) {
        this._inputEl.value = value;
        this._submitForm();
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
    helpKey: CONFIG.helpKey,
    instantRedirect: CONFIG.queryInstantRedirect,
    newTab: CONFIG.queryNewTab,
    parseQuery: queryParser.parse,
    suggester,
    toggleHelp: help.toggle,
});