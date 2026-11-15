// What a wiki's page shows that is not its text: the infobox and other boxes beside it (Fandom's is an <aside>), the
// navigation boxes at its foot, the notices and hatnotes heading it, the boxes pointing to its sister wikis, its table
// of contents, its footnote markers ([1]) and edit links (which parseMediaWiki takes out of the text they stand in),
// its references, and what is hidden or not meant to be printed.
const MEDIAWIKI_SKIP = [
  '.infobox, .portable-infobox, aside, .sidebar, .navbox, .vertical-navbox, .navigation-not-searchable, .toc, #toc',
  '.side-box, .sistersitebox, .schwesterbox, .mw-authority-control, #coordinates',
  '.hatnote, .dablink, .ambox, .msgbox, .mbox-small, .metadata, .noprint, .shortdescription, .mw-editsection',
  '.reference, .reflist, .refbegin, .mw-references-wrap, .references, .mw-cite-backlink',
  '.mw-empty-elt, .mw-collapsed, [style*="display:none"], style, link, script',
].join(', ')

// A wiki page's facts, as its infobox gives them, as one table: a row with a label and a value is a row of it, "Born |
// Parish Lesane Crooks<br>June 16, 1971", its value's lines kept apart; a row with only a heading or a picture is left
// out. Fandom's infobox gives each fact as a .pi-data, its label and value. None for a page with no facts.
function mediaWikiFacts() {
  const rows = []
  for (const row of document.querySelectorAll('#mw-content-text .infobox tr')) {
    const label = row.querySelector(':scope > th')
    const value = row.querySelector(':scope > td')
    if (label && value && label.innerText.trim() && value.innerText.trim()) {
      rows.push([label.innerText, value.innerText])
    }
  }
  for (const fact of document.querySelectorAll('#mw-content-text .portable-infobox .pi-data')) {
    const label = fact.querySelector('.pi-data-label')
    const value = fact.querySelector('.pi-data-value')
    if (label && value && label.innerText.trim() && value.innerText.trim()) {
      rows.push([label.innerText, value.innerText])
    }
  }
  return markdownTable(null, rows)
}

// Subscript and superscript forms of the letters and signs a formula's scripts are mostly made of.
const SUBSCRIPTS = Object.fromEntries(Array.from('0123456789+-−=()aehijklmnoprstuvx', (c, i) => [c, '₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ'[i]]))
const SUPERSCRIPTS = Object.fromEntries(Array.from('0123456789+-−=()abcdefghijklmnoprstuvwxyz', (c, i) => [c, '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ'[i]]))
// Operators a formula sets apart by a space on each side.
const SPACED_OPERATORS = new Set('=≠<>≤≥≈≡∼≅∝∈∉∋⊂⊃⊆⊇⊊∪∩∖×÷·∘+−±∓→←↔↦⇀⇒⇐⇔⟹⟸⟺∧∨⊢⊨≔:'.split(''))

// A formula's text, as a line can give it (MathML, which Wikipedia writes its formulas in): a script written small
// where its every character has a small form ("q₀", "n²"), else after "_" or "^" ("x_(i+1)"), a fraction with a slash,
// a root with "√", and a space either side of a relation or an operation between two terms ("a + b").
function mathText(node) {
  const children = () => Array.from(node.children)
  const part = child => (child ? mathText(child) : '')
  const grouped = text => (/^[\p{L}\p{N}]$|^[\p{L}\p{N}]+$|^\(.*\)$/u.test(text) ? text : `(${text})`)
  const script = (text, forms, mark) => {
    const bare = text.replace(/\s+/g, '')
    return Array.from(bare).every(c => forms[c]) ? Array.from(bare, c => forms[c]).join('') : `${mark}${grouped(bare)}`
  }
  const [base, first, second] = children()
  switch (node.tagName.toLowerCase()) {
    case 'annotation':
    case 'annotation-xml':
    case 'mphantom':
      return ''
    case 'semantics':
      return part(base)
    case 'mi':
    case 'mn':
    case 'mtext':
    case 'ms':
      return node.textContent
    case 'mspace':
      return ' '
    case 'mo': {
      const op = node.textContent.trim()
      if (/^[,;]$/.test(op)) {
        return `${op} `
      }
      return SPACED_OPERATORS.has(op) && node.previousElementSibling ? ` ${op} ` : op
    }
    case 'msub':
    case 'munder':
      return part(base) + script(part(first), SUBSCRIPTS, '_')
    case 'msup':
    case 'mover':
      return part(base) + script(part(first), SUPERSCRIPTS, '^')
    case 'msubsup':
    case 'munderover':
      return part(base) + script(part(first), SUBSCRIPTS, '_') + script(part(second), SUPERSCRIPTS, '^')
    case 'mfrac':
      return `${grouped(part(base).trim())}/${grouped(part(first).trim())}`
    case 'msqrt':
      return `√${grouped(children().map(mathText).join('').trim())}`
    case 'mroot':
      return `${script(part(first), SUPERSCRIPTS, '^')}√${grouped(part(base).trim())}`
    case 'mtr':
      return children().map(mathText).join(', ')
    case 'mtable':
      return children().map(mathText).join('; ')
    default:
      return children().map(mathText).join('')
  }
}

// Writes each formula of the article (.mwe-math-element, its <math> or an element holding it) as its text (see mathText), in place of its MathML (the
// browser's text of which has a line for each symbol) or its picture: a formula set on its own line as a paragraph of
// its own, unless it is in one already. A formula with no MathML is written as its picture's TeX.
function writeFormulas(body) {
  for (const formula of body.querySelectorAll('.mwe-math-element')) {
    const math = formula.matches('math') ? formula : formula.querySelector('math')
    const tex = formula.querySelector('img')?.getAttribute('alt')?.replace(/^\{\\displaystyle(.*)\}$/s, '$1')
    const text = (math ? mathText(math) : tex || '').replace(/\s+/g, ' ').trim()
    const own = formula.matches('.mwe-math-element-block') || math?.getAttribute('display') === 'block'
    const written = own && !formula.parentElement.closest('p, li, dd, dt, td, th') ? document.createElement('p') : document.createElement('span')
    written.textContent = text
    formula.replaceWith(written)
  }
}

// Makes the article's galleries (a list of pictures, each over its caption) figures of a picture and its caption, as
// pictures are elsewhere in the article, rather than list items.
function galleryFigures(body) {
  for (const gallery of body.querySelectorAll('ul.gallery')) {
    const figures = document.createElement('div')
    for (const box of gallery.querySelectorAll('li.gallerybox')) {
      const img = box.querySelector('img')
      if (img) {
        const figure = document.createElement('figure')
        const caption = document.createElement('figcaption')
        caption.textContent = box.querySelector('.gallerytext')?.innerText.trim() ?? ''
        figure.append(img, caption)
        figures.append(figure)
      }
    }
    gallery.replaceWith(figures)
  }
}

// A list the stylesheet sets out on one line, its items set apart by the separators it adds (Wikipedia's .hlist),
// written as one line, its items apart by commas, as the browser's text of it runs them together.
function joinHorizontalLists(element) {
  for (const list of element.querySelectorAll('.hlist ul, .hlist ol')) {
    if (!list.parentElement.closest('.hlist li')) {
      list.replaceWith(document.createTextNode(Array.from(list.children, li => li.innerText.trim()).filter(Boolean).join(', ')))
    }
  }
}

// Blocks without the headings of sections left with nothing in them (Notes, References, whose lists are left out).
function withoutEmptySections(blocks) {
  const level = block => /^(#{1,6}) /.exec(block)?.[1].length ?? 0
  return blocks.filter((block, i) => {
    if (!level(block)) {
      return true
    }
    const next = blocks.slice(i + 1).find(after => !level(after) || level(after) <= level(block))
    return next !== undefined && !level(next)
  })
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
// heading, its content its lead picture (the infobox's first, else none, with its caption) and the facts its infobox
// gives, as a table (see mediaWikiFacts), then its text, as textBlocks reads it with structure: each paragraph,
// heading, list item (marked, nested), quotation, code block, picture and table, leaving out the boxes, notes and
// references around it (MEDIAWIKI_SKIP) and the headings of sections left empty. Its formulas are written as text (see
// mathText), its galleries as pictures with their captions, and the button playing a word's pronunciation is left out.
// It links, with weight 0.1, as an article's links are, to each article its text links to, once, then to each site
// its text links to, then to its categories. A category's page (Category:…) links to each of its subcategories and
// articles, and a search (Special:Search, or /w/index.php?search=…) to each article it finds: both are listings, their
// own text left to the default parse.
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

  // The pronunciation's audio button, which reads as a stray "ⓘ", and what the text is read from made plain.
  body.querySelectorAll('.ext-phonos-attribution, .ext-phonos-PhonosButton').forEach(button => button.remove())
  writeFormulas(body)
  galleryFigures(body)
  // A quotation's attribution (— Turing 1948) follows it, so is made part of it.
  for (const cite of body.querySelectorAll('.templatequotecite')) {
    if (cite.previousElementSibling?.tagName === 'BLOCKQUOTE') {
      cite.previousElementSibling.append(cite)
    }
  }
  joinHorizontalLists(content)
  const leadImage = body.querySelector('.infobox img, .portable-infobox img')
  const leadCaption = leadImage?.closest('td, figure')?.querySelector('.infobox-caption, .pi-caption, figcaption')
  const lead = leadImage && imageBlock(leadImage, leadCaption?.innerText.trim() ?? '')
  // A Localnet whose helpers predate markdownTable reads neither tables nor marks, so is given rows and plain items.
  const structured = typeof markdownTable === 'function'
  const facts = structured ? mediaWikiFacts() : null
  const blocks = withoutEmptySections(textBlocks(body, structured ? { structure: true, skip: MEDIAWIKI_SKIP } : { lists: true, tables: true, skip: MEDIAWIKI_SKIP }))
    .map(block => block.replace(/[\u200B\u00AD]/g, ''))
  const categories = Array.from(document.querySelectorAll('#catlinks .mw-normal-catlinks li a[href], .page-header__categories a[href*="/wiki/"]'), a => ({
    url: a.href,
    title: a.textContent.trim(),
    score: 0.1,
  }))
  return {
    title,
    content: [lead, facts, ...blocks].filter(Boolean),
    links: [...articles.values(), ...sites.values(), ...categories],
  }
}

// The parser a scrape calls.
registerParser(parseMediaWiki)
