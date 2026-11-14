# Wikipedia, Wiktionary, Fandom scraper for Localnet

Reads `wikipedia.org`, `wiktionary.org`, `fandom.com/wiki/` pages for Localnet, a browser extension that is a personal search engine.
Localnet pulls it from here the first time it scrapes such a page, through the
[localnet-scrapers](https://github.com/opowell/localnet-scrapers) scraper source.

- `source.json`: what Localnet reads to know the scrapers: their names, the URLs they read, how the site is searched, and the file to run.
- `mediawiki.js`: the parser. It is injected into the scraped page after Localnet's DOM helpers (content-scripts/utils/dom.js) and defines `window.__dynamicParser`.
- `mediawiki.test.ts`: its unit tests, run from a Localnet checkout (`pnpm parsers pull`, then `pnpm test parsers/localnet-scraper-mediawiki`).
- `saved-pages/` (not in git): real pages saved from the site, which Localnet's `e2e/saved-pages.test.ts` scrapes. See Localnet's README.

## What it reads

The **MediaWiki** parser (`content-scripts/parsers/mediawiki.js`) reads the wikis built on MediaWiki, each its own scraper: **Wikipedia** (`wikipedia.org`, every language), **Wiktionary** (`wiktionary.org`) and **Fandom** (`fandom.com/wiki/`). An article's title is its heading (`#firstHeading`), and its content its lead picture (the infobox's first, uncaptioned), then the facts its infobox gives, one block each (`"Born: Alan Mathison Turing, 23 June 1912, Maida Vale"`: a row with a label and a value; Fandom's `.pi-data`), the items of a list the stylesheet sets apart (`.hlist`) joined with commas, then each paragraph, heading, list item, code block, picture and table row of its text (`.mw-parser-output`; a row is one block of its cells, `"1936 · Paper"`, as `textBlocks`' `tables` option reads it), leaving out the boxes around it (the infobox, navigation boxes, notices and hatnotes, the table of contents) and its references. Footnote markers (`[6]`) and edit links stand within the text, so are taken out of the page first. It links, with weight `0.1` as an article's links are, to each article its text links to once (a link to a page that does not exist, `a.new`, or to one of the wiki's namespaces, `Help:IPA`, `File:…`, told by a colon directly followed by more, where an article's title has a space after it, `Star Wars: Episode IV`, is left out), then to each other site its text links to, then to its categories (`#catlinks`, Fandom's `.page-header__categories`). A category's page (`Category:Logicians`) is a listing of its subcategories and articles (`#mw-subcategories li a`, `#mw-pages li a`, Fandom's `.category-page__member-link`), and a search (`Special:Search`, `/w/index.php?search=…`) of the articles it finds (`.mw-search-result-heading a`).
