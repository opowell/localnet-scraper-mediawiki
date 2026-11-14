// What a wiki's page shows that is not its text: the infobox and other boxes beside it (Fandom's is an <aside>), the
// navigation boxes at its foot, the notices and hatnotes heading it, its table of contents, its footnote markers ([1])
// and edit links (which parseMediaWiki takes out of the text they stand in), its references, and what is hidden or not
// meant to be printed.
const MEDIAWIKI_SKIP = [
  '.infobox, .portable-infobox, aside, .sidebar, .navbox, .vertical-navbox, .navigation-not-searchable, .toc, #toc',
  '.hatnote, .dablink, .ambox, .msgbox, .mbox-small, .metadata, .noprint, .shortdescription, .mw-editsection',
  '.reference, .reflist, .refbegin, .mw-references-wrap, .references, .mw-cite-backlink',
  '.mw-empty-elt, .mw-collapsed, [style*="display:none"], style, link, script',
].join(', ')

// A wiki page's facts, as its infobox gives them: a row with a label and a value is "Born: 23 June 1912 Maida Vale"
// (its value's lines joined); a row with only a heading or a picture is left out. Fandom's infobox gives each fact as a
// .pi-data, its label and value.
function mediaWikiFacts() {
  const facts = []
  // A list's items are set apart by the stylesheet alone (Wikipedia's .hlist), so are joined here.
  const line = (element) => {
    const items = element.querySelectorAll('li')
    const text = items.length ? Array.from(items, li => li.innerText).join(', ') : element.innerText
    return text.replace(/\s*\n\s*/g, ', ').replace(/\s+/g, ' ').trim()
  }
  for (const row of document.querySelectorAll('#mw-content-text .infobox tr')) {
    const label = row.querySelector(':scope > th')
    const value = row.querySelector(':scope > td')
    if (label && value && line(label) && line(value)) {
      facts.push(`${line(label)}: ${line(value)}`)
    }
  }
  for (const fact of document.querySelectorAll('#mw-content-text .portable-infobox .pi-data')) {
    const label = fact.querySelector('.pi-data-label')
    const value = fact.querySelector('.pi-data-value')
    if (label && value && line(label) && line(value)) {
      facts.push(`${line(label)}: ${line(value)}`)
    }
  }
  return facts
}

// Whether a link within the wiki leads to an article, not to a page of one of its namespaces (File:, Help:, Talk:,
// Category:, which are linked to apart), told by its title starting with a word and a colon directly followed by more,
// where an article's colon is followed by a space ("Star Wars: Episode IV").
function mediaWikiArticle(url) {
  if (url.origin !== location.origin || !url.pathname.startsWith('/wiki/') || url.search) {
    return false
  }
  return !/^[^:_/]+(?:_talk)?:[^_]/.test(decodeURIComponent(url.pathname.slice(6)))
}

// A page of a MediaWiki wiki (Wikipedia, Wiktionary, a Fandom wiki) reads as its article: its title the page's
// heading, its content its lead picture (the infobox's first, else none) and the facts its infobox gives (see
// mediaWikiFacts), then each paragraph, heading, list item, code block, picture and table row of its text, leaving out
// the boxes, notes and references around it (MEDIAWIKI_SKIP). It links, with weight 0.1, as an article's links are, to
// each article its text links to, once, then to each site its text links to, then to its categories. A category's page
// (Category:…) links to each of its subcategories and articles, and a search (Special:Search, or /w/index.php?search=…)
// to each article it finds: both are listings, their own text left to the default parse.
function parseMediaWiki(_profileId) {
  const content = document.querySelector('#mw-content-text')
  if (!content || !document.querySelector('#firstHeading')) {
    return null
  }
  if (document.querySelector('.mw-search-results, .unified-search__results, .mw-search-nonefound')) {
    return listingOf(linkUrls('.mw-search-result-heading a[href], .unified-search__result__title[href]')) ?? { listing: true }
  }
  if (document.querySelector('#mw-pages, #mw-subcategories, .category-page__members')) {
    return listingOf(linkUrls('#mw-subcategories li a[href], #mw-pages li a[href], a.category-page__member-link[href]')) ?? { listing: true }
  }
  const body = content.querySelector('.mw-parser-output') || content
  // Footnote markers ([6], [note 1]) and edit links stand within the text, so are taken out of it. The scrape's tab is
  // its own, so the page itself is changed.
  body.querySelectorAll('sup.reference, .mw-ref, .mw-editsection, sup.noprint').forEach(marker => marker.remove())
  const title = document.querySelector('#firstHeading').innerText.trim()
  const leadImage = body.querySelector('.infobox img, .portable-infobox img')
  const lead = leadImage && imageBlock(leadImage, '')
  const blocks = textBlocks(body, { lists: true, tables: true, skip: MEDIAWIKI_SKIP })

  const articles = new Map()
  const sites = new Map()
  for (const a of body.querySelectorAll('a[href]')) {
    if (a.closest(MEDIAWIKI_SKIP) || a.classList.contains('new')) {
      continue
    }
    const url = new URL(a.href)
    url.hash = ''
    const name = a.textContent.trim()
    if (mediaWikiArticle(url)) {
      if (url.href !== location.href.split('#')[0] && !articles.has(url.href)) {
        articles.set(url.href, { url: url.href, title: name || undefined, score: 0.1 })
      }
    } else if (url.origin !== location.origin && /^https?:$/.test(url.protocol) && name && !sites.has(url.href)) {
      sites.set(url.href, { url: url.href, title: name, score: 0.1 })
    }
  }
  const categories = Array.from(document.querySelectorAll('#catlinks .mw-normal-catlinks li a[href], .page-header__categories a[href*="/wiki/"]'), a => ({
    url: a.href,
    title: a.textContent.trim(),
    score: 0.1,
  }))
  return {
    title,
    content: [...(lead ? [lead] : []), ...mediaWikiFacts(), ...blocks],
    links: [...articles.values(), ...sites.values(), ...categories],
  }
}

// The parser a scrape calls.
registerParser(parseMediaWiki)
