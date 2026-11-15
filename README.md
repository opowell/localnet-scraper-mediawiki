# Wikipedia, Wiktionary, Fandom scraper for Localnet

Reads `wikipedia.org`, `wiktionary.org`, `fandom.com/wiki/` pages for Localnet, a browser extension that is a personal search engine.
Localnet pulls it from here the first time it scrapes such a page, through the
[localnet-scrapers](https://github.com/opowell/localnet-scrapers) scraper source.

- `source.json`: what Localnet reads to know the scrapers: their names, the URLs they read, how the site is searched, and the file to run.
- `mediawiki.js`: the parser. It is injected into the scraped page after Localnet's DOM helpers (content-scripts/utils/dom.js) and defines `window.__dynamicParser`.
- `scenarios/`: a `pnpm try` scenario showing a saved article in Read.
- `mediawiki.test.ts`: its unit tests, run from a Localnet checkout (`pnpm parsers pull`, then `pnpm test parsers/localnet-scraper-mediawiki`).
- `saved-pages/` (not in git): real pages saved from the site, which Localnet's `e2e/saved-pages.test.ts` scrapes. See Localnet's README.

## What it reads

The **MediaWiki** parser (`mediawiki.js`) reads the wikis built on MediaWiki, each its own scraper: **Wikipedia** (`wikipedia.org`, every language), **Wiktionary** (`wiktionary.org`) and **Fandom** (`fandom.com/wiki/`). It aims to read an article at least as well as a browser's reader view does. An article's title is its heading (`#firstHeading`), and its content:

- its lead picture (the infobox's first), with the infobox's caption (`Shakur in 1995`);
- the facts its infobox gives, as one table without headings, a fact to a row (`| Born | Parish Lesane Crooks<br>June 16, 1971 |`: a row with a label and a value, its value's lines kept apart; Fandom's `.pi-data`), the items of a list the stylesheet sets on one line (`.hlist`) joined with commas;
- then its text (`.mw-parser-output`), as Localnet's `textBlocks` reads it with `structure` and `links`: each paragraph, heading, picture (a gallery's with its caption), list item (`- item`, `1. item`, nested two spaces deeper), quotation (`> …`, with its attribution, `> — Turing 1948`), code block and definition, and each table as one Markdown table, its spanning cells filled in (a box laying out tables read through, a chart drawn with tables left out, as German Wikipedia's climate tables have one beside their numbers); its links written in, `[logician](https://en.wikipedia.org/wiki/Logic)` (a red link, `a.new`, as its text);
- its footnotes: each mark in the text (`[1]`, `[a]`, `[note 1]`) as `[^1]`, and each note and reference of its lists (`ol.references`) as a block of its own, `[^1]: Robinson 2024.`, labelled as the marks pointing to it are (a group's own letters), else by its number, without the links back to its marks. The works it cites (`.refbegin`) are lists like any other.

Formulas (MathML, `.mwe-math-element`) are written as text, `M = ⟨Q, Γ, b, Σ, δ, q₀, F⟩`: a script small where every character has a small form (`q₀`, `n²`), else after `_` or `^`, a fraction with a slash, a root with `√`, and relations and operations spaced. It leaves out the boxes around the text (the infobox, sidebars, navigation boxes, notices and hatnotes, the sister-project boxes, authority control, coordinates, the table of contents) and the headings of the sections that leaves empty. Edit links, `[citation needed]` and the pronunciation's audio button (`ⓘ`) stand within the text, so are taken out of the page first. A Localnet whose helpers predate `withLinksWritten` gets no links or footnotes (the marks taken out, the references left out), and one predating `markdownTable` gets rows and plain items, as before.

It links, with weight `0.1` as an article's links are, to each article its text links to once (a link to a page that does not exist, `a.new`, or to one of the wiki's namespaces, `Help:IPA`, `File:…`, told by a colon directly followed by more, where an article's title has a space after it, `Star Wars: Episode IV`, is left out), then to each other site its text links to (not its references), then to its categories (`#catlinks`, Fandom's `.page-header__categories`). A category's page (`Category:Logicians`) is a listing of its subcategories and articles (`#mw-subcategories li a`, `#mw-pages li a`, Fandom's `.category-page__member-link`), and a search (`Special:Search`, `/w/index.php?search=…`) of the articles it finds (`.mw-search-result-heading a`).

`scenarios/wikipedia.ts` opens a saved article in Read (`pnpm try wikipedia`; `WIKI_PAGE=<saved page>` for another, `WIKI_TURN=<n>` to turn n pages on).
