// Pull a brand from an MSB's existing website: name, logo and a primary colour.
// Uses the Netlify function when deployed; falls back to a public favicon service in local demos.

const hexOf = (c) => {
  if (!c) return null
  const m = c.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (m) { const h = m[1]; return '#' + (h.length === 3 ? h.split('').map((x) => x + x).join('') : h).toUpperCase() }
  const r = c.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i)
  return r ? '#' + [r[1], r[2], r[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase() : null
}

// Dominant saturated colour of an image (data URL or same-origin URL). Ignores near-white, near-black and transparent pixels.
export function dominantColor(src) {
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); const s = 48; cv.width = s; cv.height = s
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, s, s)
        const d = ctx.getImageData(0, 0, s, s).data; const buckets = {}
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]
          if (a < 128) continue
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const sat = mx ? (mx - mn) / mx : 0; const lum = (r + g + b) / 3
          if (lum > 235 || lum < 25 || sat < 0.25) continue
          const k = `${r >> 4},${g >> 4},${b >> 4}`; buckets[k] = (buckets[k] || 0) + 1 + sat
        }
        const best = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
        if (!best) return resolve(null)
        const [r, g, b] = best[0].split(',').map((n) => (+n << 4) + 8)
        resolve('#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase())
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function fetchBrand(url) {
  const clean = url.trim().replace(/\s/g, '')
  if (!clean) throw new Error('Enter your website address.')
  let host; try { host = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`).hostname } catch { throw new Error('That does not look like a website address.') }
  let out = { name: host.replace(/^www\./, ''), logo: null, color: null, source: 'favicon' }
  try {
    const r = await fetch(`/.netlify/functions/brand?url=${encodeURIComponent(clean)}`)
    const j = await r.json()
    if (r.ok) { out = { name: j.name || out.name, logo: j.logoDataUrl || null, color: hexOf(j.themeColor), source: 'site' } }
    else if (j.error) throw new Error(j.error)
  } catch (e) {
    if (e.message && !/fetch|JSON|network|Unexpected/i.test(e.message)) throw e
    // Local demo without functions: use a public favicon service for the logo (colour guessed from it where CORS allows)
    out.logo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
  }
  if (!out.color && out.logo) out.color = await dominantColor(out.logo)
  return out
}
