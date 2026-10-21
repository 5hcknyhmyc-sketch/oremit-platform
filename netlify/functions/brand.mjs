// Netlify Function: fetch an MSB's website and pull out what we need to pre-fill their brand —
// site name, theme colour and the best logo we can find (returned as a data URL so the browser
// can read its pixels for a dominant-colour guess without cross-origin problems).
// GET /.netlify/functions/brand?url=https://example.co.uk

const TIMEOUT = 7000
const UA = 'Mozilla/5.0 (compatible; TheFXSoftBrandBot/1.0; +https://thefxsoft.com)'

const get = async (url, opts = {}) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT)
  try { return await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' }, signal: ctl.signal, ...opts }) } finally { clearTimeout(t) }
}
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i')); return m ? m[1] : null }
const abs = (base, href) => { try { return new URL(href, base).href } catch { return null } }

export default async (req) => {
  const q = new URL(req.url).searchParams.get('url') || ''
  let site
  try { site = new URL(/^https?:\/\//i.test(q) ? q : `https://${q}`) } catch { return Response.json({ error: 'Enter a valid website address' }, { status: 400 }) }
  if (!/^https?:$/.test(site.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(site.hostname)) return Response.json({ error: 'That address cannot be used' }, { status: 400 })
  let html = ''
  try { const r = await get(site.href); html = (await r.text()).slice(0, 400000); site = new URL(r.url || site.href) } catch (e) { return Response.json({ error: 'We could not reach that website' }, { status: 502 }) }

  const tags = html.match(/<(meta|link|title)[^>]*>(?:[^<]*<\/title>)?/gi) || []
  let themeColor = null, name = null, title = null
  const icons = []
  for (const tg of tags) {
    const low = tg.toLowerCase()
    if (low.startsWith('<meta')) {
      const n = (attr(tg, 'name') || attr(tg, 'property') || '').toLowerCase(), c = attr(tg, 'content')
      if (n === 'theme-color' && c && !themeColor) themeColor = c
      if (n === 'og:site_name' && c) name = c
      if (n === 'og:image' && c) icons.push({ href: c, score: 3 })
      if (n === 'msapplication-tileimage' && c) icons.push({ href: c, score: 4 })
      if (n === 'msapplication-tilecolor' && c && !themeColor) themeColor = c
    } else if (low.startsWith('<link')) {
      const rel = (attr(tg, 'rel') || '').toLowerCase(), href = attr(tg, 'href'), sizes = attr(tg, 'sizes') || ''
      if (!href) continue
      const big = +(sizes.split('x')[0] || 0)
      if (rel.includes('apple-touch-icon')) icons.push({ href, score: 6 + (big >= 180 ? 1 : 0) })
      else if (rel.includes('icon')) icons.push({ href, score: href.endsWith('.svg') ? 7 : 2 + Math.min(3, big / 64) })
    } else if (low.startsWith('<title')) { const m = tg.match(/<title[^>]*>([^<]*)/i); if (m) title = m[1].trim() }
  }
  // Common logo <img> tags
  for (const img of (html.match(/<img[^>]+>/gi) || []).slice(0, 60)) {
    const src = attr(img, 'src') || attr(img, 'data-src'); const al = (attr(img, 'alt') || '') + ' ' + (attr(img, 'class') || '') + ' ' + (attr(img, 'id') || '') + ' ' + (src || '')
    if (src && /logo|brand/i.test(al)) icons.push({ href: src, score: /\.svg(\?|$)/i.test(src) ? 9 : 8 })
  }
  icons.push({ href: '/apple-touch-icon.png', score: 1 }, { href: '/favicon.ico', score: 0 })
  icons.sort((a, b) => b.score - a.score)

  let logoDataUrl = null, logoUrl = null, logoType = null
  for (const ic of icons.slice(0, 6)) {
    const u = abs(site.href, ic.href); if (!u) continue
    try {
      const r = await get(u); if (!r.ok) continue
      const type = r.headers.get('content-type') || ''
      if (!type.startsWith('image/')) continue
      const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 200 || buf.length > 1500000) continue
      logoDataUrl = `data:${type.split(';')[0]};base64,${buf.toString('base64')}`; logoUrl = u; logoType = type; break
    } catch { /* try next */ }
  }
  const clean = (s) => s && s.replace(/\s*[|\-–—:·].*$/, '').trim().slice(0, 60)
  return Response.json({ site: site.origin, name: clean(name) || clean(title) || site.hostname.replace(/^www\./, ''), themeColor, logoUrl, logoDataUrl, logoType }, { headers: { 'cache-control': 'public, max-age=3600' } })
}

