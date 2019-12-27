import {formatDistanceToNow, parseISO} from 'date-fns'
import escapeHTML from 'escape-html'
import {Feed} from 'feed'
import style from '../public/style.css'
import {fetchFavorites} from './twitter'
import {fetchFeedbinEntries} from './feedbin'

export interface FeedItem {
  id: string
  title: string
  link: string
  date: string
  content?: string
  hn: string | false
  twitter: string | false
  twitterUsername?: string
}

// const API_HOSTNAME = 'https://links.jacobwgillespie.workers.dev'

export async function fetchFeedItems() {
  const feedbinItems: Promise<FeedItem[]> = fetchFeedbinEntries() // fetch(`${API_HOSTNAME}/api/feedbin`).then(res => res.json())
  const twitterItems: Promise<FeedItem[]> = fetchFavorites() //fetch(`${API_HOSTNAME}/api/twitter`).then(res => res.json())

  const items = (await Promise.all([feedbinItems, twitterItems])).flat()

  // Return entries, sorted in reverse chronological order
  return items.sort((a, b) => {
    if (a.date < b.date) return 1
    if (b.date < a.date) return -1
    return 0
  })
}

export async function buildFeed() {
  const items = await fetchFeedItems()

  const feed = new Feed({
    title: 'Links by Jacob',
    id: 'https://links.jacobwgillespie.com/feed.xml',
    copyright: '',
    generator: 'https://github.com/jacobwgillespie/links-by-jacob',
    feedLinks: {
      atom: 'https://links.jacobwgillespie.com/atom',
      json: 'https://links.jacobwgillespie.com/json',
    },
  })

  for (const item of items) {
    feed.addItem({
      title: item.title,
      guid: item.id,
      link: item.link,
      date: parseISO(item.date),
      content: item.content,
    })
  }

  return feed
}

export function template(url: string, items: FeedItem[]) {
  // If in debug mode, disable service worker
  const serviceWorker = DEBUG
    ? "if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(registrations){for(const registration of registrations){registration.unregister()}})}"
    : "if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}"

  const itemsHTML: string[] = []

  for (const item of items) {
    const isoDate = item.date
    const relativeDate = `${formatDistanceToNow(parseISO(item.date))} ago`

    const hnLink = item.hn
      ? `<a href="https://news.ycombinator.com/item?id=${item.hn}" target="_blank" rel="noopener" class="hn">HN</a> `
      : ''

    const twitterLink = item.twitter
      ? `<a href="${escapeHTML(
          item.twitter,
        )}" target="_blank" rel="noopener" class="tw"><svg viewBox="0 0 24 24"><g><path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"></path></g></svg>&nbsp;${item.twitterUsername ||
          ''}</a> `
      : ''

    itemsHTML.push(
      `
<article>
<a href="${escapeHTML(item.link)}" target="_blank" rel="noopener"><h2>${escapeHTML(item.title)}</h2></a>
${hnLink}
${twitterLink}
<time datetime="${escapeHTML(isoDate)}" title="${escapeHTML(isoDate)}">${escapeHTML(relativeDate)}</time>
</article>
  `.trim(),
    )
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#222222"/>
<meta property="og:title" content="Links by Jacob" />
<meta property="og:url" content="https://links.jacobwgillespie.com${url}" />
<meta property="og:description" content="Starred links from my feed reader." />
<title>Links by Jacob</title>
<meta name="Description" content="Starred links from my feed reader." />
<style>${style}</style>
<link rel="shortcut icon" href="/icon-192x192.png" />
<link rel="apple-touch-icon" href="/icon-192x192.png">
<link rel="manifest" href="/manifest.json">
<link rel="alternate" type="application/rss+xml" title="Links by Jacob RSS feed" href="/rss" />
<link rel="alternate" type="application/atom+xml" title="Links by Jacob RSS feed" href="/atom" />
<link rel="alternate" type="application/json" title="Links by Jacob RSS feed" href="/json" />
</head>
<body>
<h1>Links by Jacob</h1>
${itemsHTML.join('\n')}
<footer>
<span>Copyright &copy; ${new Date().getFullYear()} <a href="https://jacobwgillespie.com" target="_blank" rel="noopener">Jacob Gillespie</a></span> <a href="/rss">RSS</a> <a href="/atom">Atom</a> <a href="/json">JSON</a>
</footer>
<script>${serviceWorker}</script>
</body>
</html>
  `.trim()
}