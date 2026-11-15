import { afterEach, describe, expect, it } from 'vitest'
import { parserLoader, resetPage, visit } from '#scraper-test'

// The parser, evaluated with the helpers it is injected with, as a scrape runs it.
const load = parserLoader(__dirname)

afterEach(resetPage)

describe('mediaWiki', () => {
  const { parseMediaWiki } = load('mediawiki.js', ['parseMediaWiki'])

  it('reads an article as its lead picture, its infobox\'s facts as a table and its text, without footnotes, boxes or edit links', () => {
    visit('https://en.wikipedia.org/wiki/Alan_Turing', `
      <h1 id="firstHeading">Alan Turing</h1>
      <div id="mw-content-text"><div class="mw-parser-output">
        <div class="hatnote">For other uses, see Turing.</div>
        <table class="infobox">
          <tr><td class="infobox-image"><img src="https://upload.wikimedia.org/turing.jpg" width="220" height="300" alt="Turing"><div class="infobox-caption">Turing in 1928</div></td></tr>
          <tr><th>Born</th><td><div>23 June 1912</div><div>Maida Vale</div></td></tr>
          <tr><th>Known for</th><td><div class="hlist"><ul><li>Enigma</li><li>Turing test</li></ul></div></td></tr>
          <tr><th colspan="2">Signature</th></tr>
        </table>
        <p>Alan Turing was a <a href="/wiki/Logic">logician</a><sup class="reference"><a href="#cite-1">[1]</a></sup> who worked on
          <a href="/wiki/Star_Wars:_Episode_IV">a film</a>, <a href="/wiki/Help:IPA">IPA</a>, <a class="new" href="/wiki/Nothing">nothing</a>
          and <a class="external" href="https://www.turing.org.uk/">his site</a>.</p>
        <div class="mw-heading mw-heading2"><h2>Life</h2><span class="mw-editsection">[edit]</span></div>
        <table class="wikitable"><tr><th>Year</th><th>Event</th></tr><tr><td>1936</td><td>Paper</td></tr></table>
        <div class="navbox"><p>Navigation</p><a href="/wiki/Other">Other</a></div>
        <div class="mw-heading mw-heading2"><h2>References</h2></div>
        <div class="reflist"><ol class="references"><li>A book.</li></ol></div>
      </div></div>
      <div id="catlinks"><div class="mw-normal-catlinks"><a href="/wiki/Special:Categories">Categories</a>: <ul><li><a href="/wiki/Category:Logicians">Logicians</a></li></ul></div></div>`)
    expect(parseMediaWiki()).toEqual({
      title: 'Alan Turing',
      content: [
        '![Turing in 1928](https://upload.wikimedia.org/turing.jpg)',
        '|  |  |\n| --- | --- |\n| Born | 23 June 1912<br>Maida Vale |\n| Known for | Enigma, Turing test |',
        expect.stringMatching(/^Alan Turing was a logician who worked on\s+a film, IPA, nothing\s+and his site\.$/),
        '## Life',
        '| Year | Event |\n| --- | --- |\n| 1936 | Paper |',
      ],
      links: [
        { url: 'https://en.wikipedia.org/wiki/Logic', title: 'logician', score: 0.1 },
        { url: 'https://en.wikipedia.org/wiki/Star_Wars:_Episode_IV', title: 'a film', score: 0.1 },
        { url: 'https://www.turing.org.uk/', title: 'his site', score: 0.1 },
        { url: 'https://en.wikipedia.org/wiki/Category:Logicians', title: 'Logicians', score: 0.1 },
      ],
    })
  })

  it('marks lists and quotations, writes formulas as text, and gives a gallery\'s pictures their captions', () => {
    visit('https://en.wikipedia.org/wiki/Turing_machine', `
      <h1 id="firstHeading">Turing machine</h1>
      <div id="mw-content-text"><div class="mw-parser-output">
        <p>A 7-tuple <math class="mwe-math-element mwe-math-element-inline"><semantics><mrow><mi>M</mi><mo>=</mo><mo>⟨</mo><mi>Q</mi><mo>,</mo><msub><mi>q</mi><mn>0</mn></msub><mo>⟩</mo></mrow><annotation encoding="application/x-tex">M = \\langle Q, q_0 \\rangle</annotation></semantics></math> where
          /ˈtjʊərɪŋ/<span class="ext-phonos-PhonosButton"><a role="button"></a></span><sup class="ext-phonos-attribution"><a href="/wiki/File:Turing.wav">ⓘ</a></sup></p>
        <ul><li>States<ul><li><math class="mwe-math-element"><msup><mi>n</mi><mn>2</mn></msup><mo>+</mo><mfrac><mn>1</mn><mi>x</mi></mfrac></math></li></ul></li></ul>
        <ol><li>Write</li><li>Move</li></ol>
        <blockquote class="templatequote"><p>An unlimited memory.</p></blockquote><div class="templatequotecite"><p>— Turing 1948</p></div>
        <ul class="gallery"><li class="gallerybox"><img src="https://upload.wikimedia.org/tape.jpg" width="120" height="120" alt=""><div class="gallerytext">The tape</div></li></ul>
      </div></div>`)
    expect(parseMediaWiki().content).toEqual([
      expect.stringMatching(/^A 7-tuple M = ⟨Q, q₀⟩ where\s+\/ˈtjʊərɪŋ\/$/),
      '- States',
      '  - n² + 1/x',
      '1. Write',
      '2. Move',
      '> An unlimited memory.',
      '> — Turing 1948',
      '![The tape](https://upload.wikimedia.org/tape.jpg)',
    ])
  })

  it.each([
    ['a category', 'https://en.wikipedia.org/wiki/Category:Logicians', '<div id="mw-subcategories"><a href="/wiki/Help:Category">Help</a><ul><li><a href="/wiki/Category:Greek_logicians">Greek</a></li></ul></div><div id="mw-pages"><ul><li><a href="/wiki/Alan_Turing">Alan Turing</a></li></ul></div>', ['https://en.wikipedia.org/wiki/Category:Greek_logicians', 'https://en.wikipedia.org/wiki/Alan_Turing']],
    ['a search', 'https://en.wikipedia.org/w/index.php?search=halting', '<ul class="mw-search-results"><li><div class="mw-search-result-heading"><a href="/wiki/Halting_problem">Halting problem</a></div></li></ul>', ['https://en.wikipedia.org/wiki/Halting_problem']],
    ['a Fandom category', 'https://minecraft.fandom.com/wiki/Category:Mobs', '<div class="category-page__members"><a class="category-page__member-link" href="/wiki/Creeper">Creeper</a></div>', ['https://minecraft.fandom.com/wiki/Creeper']],
  ])('reads %s as a listing of what it names', (_, url, body, listed) => {
    visit(url, `<h1 id="firstHeading">A page</h1><div id="mw-content-text">${body}</div>`)
    expect(parseMediaWiki().links.map((link: any) => link.url)).toEqual(listed)
  })
})
