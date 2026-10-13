// Netlify Function: the platform's AI assistant.
// Set ANTHROPIC_API_KEY in Netlify → Site configuration → Environment variables.
// Optional: AI_MODEL (defaults to claude-sonnet-5-5).
// Before production: require a signed-in staff session here and rate-limit per tenant.

const BASE = `You are the compliance assistant built into CoRemit, a platform used by UK money service businesses (MSBs) to send remittances.
You help MSB staff and their MLRO apply the Money Laundering, Terrorist Financing and Transfer of Funds Regulations 2017, the Proceeds of Crime Act 2002, the Payment Services Regulations 2017, FCA expectations and JMLSG guidance.
Rules for your answers:
- Be specific to the data you are given. Quote figures from it. Never invent customers, transfers or facts.
- You support decisions; a human makes them. Say what evidence would change your view.
- Never suggest telling a customer about a SAR or internal suspicion (tipping off).
- Plain British English, short paragraphs or bullet points. Use **bold** for key facts. No preamble.`

const TASKS = {
  chat: `${BASE}\nAnswer the staff member's question using the MSB data in the context.`,
  case_review: `${BASE}\nReview this compliance case. Structure: **Summary** (2–3 lines), **Risk indicators**, **Mitigating factors**, **Information to request from the customer**, **Suggested decision** (release / request more info / reject / escalate to MLRO for SAR) with a one-line rationale, and a draft case note the reviewer can edit.`,
  policy: `${BASE}\nYou are drafting or improving an MSB policy document. Return the full document in Markdown (headings with #, lists with -). Keep the MSB's name and details from the context. End with a "Review with your MLRO" line.`,
  rule: `${BASE}\nConvert the staff member's description into ONE monitoring rule. Reply with JSON only, no prose, matching:
{"type": one of [amount_over, first_txn_over, velocity_count, cumulative_over, structuring, many_senders, corridor, customer_risk, kyc_incomplete, pep, sanctions, sof_missing, young_sender],
 "name": short name, "action": "flag"|"hold"|"block", "severity": "low"|"medium"|"high",
 "params": object using keys amount, days, count, threshold, age, currencies (array of ISO codes), levels (array of Low/Medium/High) as the type needs,
 "explanation": one sentence}`,
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return Response.json({ error: 'ai_disabled' }, { status: 503 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { task = 'chat', messages = [], context = {} } = body
  if (!Array.isArray(messages) || !messages.length) return Response.json({ error: 'No question given' }, { status: 400 })

  const system = `${TASKS[task] || TASKS.chat}\n\nContext (JSON):\n${JSON.stringify(context).slice(0, 60000)}`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-5-5',
      max_tokens: task === 'policy' ? 4000 : 1500,
      system,
      messages: messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 8000) })),
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return Response.json({ error: j.error?.message || `AI request failed (${r.status})` }, { status: 502 })
  return Response.json({ text: (j.content || []).map((c) => c.text || '').join('') })
}
