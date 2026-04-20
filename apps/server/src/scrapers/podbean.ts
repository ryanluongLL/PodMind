import puppeteer from 'puppeteer'
import type { ParsedPodcast, ParsedEpisode } from './rss.js'

export async function scrapePodbean(podbeanUrl: string): Promise<ParsedPodcast> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(podbeanUrl, { waitUntil: 'networkidle2' })

  const name = await page.$eval(
    '.podcast-title, h1',
    (el) => el.textContent?.trim() ?? 'Unknown'
  )

  const iconUrl = await page.$eval(
    '.podcast-logo img, .podcast-cover img',
    (el) => (el as any).src
  ).catch(() => null)

  const episodes: ParsedEpisode[] = await page.$$eval(
    '.episode-item, .episode-list-item',
    (els) =>
      els.slice(0, 20).map((el) => ({
        title: el.querySelector('.episode-title, h3')?.textContent?.trim() ?? 'Untitled',
        episodeUrl: (el.querySelector('a') as any)?.href ?? '',
        iconUrl: (el.querySelector('img') as any)?.src ?? null,
        publishedAt: el.querySelector('.date, .episode-date')?.textContent?.trim()
          ? new Date(el.querySelector('.date, .episode-date')!.textContent!.trim())
          : null,
      }))
  )

  await browser.close()
  return { name, iconUrl, episodes }
}