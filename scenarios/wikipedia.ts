import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Scenario } from '#e2e/scenarios/index.ts'
import { savedPagesDir, withScriptsInert } from '#e2e/support/saved-pages.ts'

// The saved Wikipedia page to read (`pnpm saved-pages`), from the main checkout's saved-pages/, which every worktree
// shares: WIKI_PAGE names one (without .json),
// Tupac Shakur's article by default, its infobox, lists, quotations and tables all in it. WIKI_TURN turns that many
// pages on.
const SAVED = savedPagesDir('localnet-scraper-mediawiki')

export const wikipedia: Scenario = {
  about: 'a saved Wikipedia article (WIKI_PAGE, Tupac Shakur\'s by default), scraped and open in Read',
  async run({ app, site }) {
    const file = path.join(SAVED, `${process.env.WIKI_PAGE ?? 'en-wikipedia-org-wiki-tupac-shakur'}.json`)
    if (!fs.existsSync(file)) {
      throw new Error(`No saved page ${file}: save it with pnpm saved-pages fetch <url>`)
    }
    const { url, html } = JSON.parse(fs.readFileSync(file, 'utf8'))
    site.serve(url, withScriptsInert(html))
    await app.scrape(url)
    await app.go(`#/?q=${encodeURIComponent(`item="${url}"`)}&v=record`)
    await app.page.locator('.reader-flow').waitFor()
    await app.page.waitForTimeout(1000)
    for (let turned = 0; turned < Number(process.env.WIKI_TURN ?? 0); turned++) {
      await app.page.keyboard.press('n')
    }
    await app.page.waitForTimeout(500)
  },
}

export default wikipedia
