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
    queryPathDelimiter: "/",

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
        q: ["bin", "yah", "eco", "ddg", "*"],
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
        { name: "Default", limit: 4 },
        { name: "History", limit: 4, minChars: 2 },
        { name: "DuckDuckGo", limit: 4, minChars: 2 },
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
            key: "*",
            search: "/search?q={}",
            url: "https://www.google.com",
        },
        {
            key: "bin",
            search: "/search?q={}",
            url: "https://www.bing.com",
        },
        {
            key: "ddg",
            search: "/?q={}",
            url: "https://duckduckgo.com",
        },
        {
            key: "eco",
            search: "/search?q={}",
            url: "https://www.ecosia.org",
        },
        {
            key: "yah",
            search: "/search?p={}",
            url: "https://search.yahoo.com",
        },
    ],
};
