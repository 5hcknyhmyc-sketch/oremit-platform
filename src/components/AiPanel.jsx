import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send } from 'lucide-react'
import { Drawer } from './ui'
import { useDb } from '../store'
import { askAi, AiOffline, tenantContext, fallbackChat } from '../lib/ai'

const QUICK = ["Summarise today's compliance queue", 'Which customers need enhanced due diligence?', 'Are any of our rules too loose for structuring?', 'What should our MLRO report to the board this month?']

export default function AiPanel({ tenant }) {
  const db = useDb()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy])

  async function ask(text) {
    if (!text.trim() || busy) return
    const next = [...msgs, { role: 'user', content: text.trim() }]
    setMsgs(next); setQ(''); setBusy(true)
    const ctx = tenantContext(db, tenant)
    try {
      const a = await askAi('chat', next, ctx)
      setMsgs([...next, { role: 'assistant', content: a }])
    } catch (e) {
      const a = e instanceof AiOffline ? fallbackChat(text, ctx) : `Error: ${e.message}`
      setMsgs([...next, { role: 'assistant', content: a, offline: e instanceof AiOffline }])
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn pri ai-fab" onClick={() => setOpen(true)}><Sparkles />Ask AI</button>
      {open && (
        <Drawer title="Compliance assistant" onClose={() => setOpen(false)}>
          <div className="ai-msgs" style={{ padding: 0 }}>
            {!msgs.length && (
              <div className="stack-s">
                <p className="muted small">Ask about your transfers, customers, alerts or rules. Answers use {tenant.name}'s live data. You make the final decision.</p>
                {QUICK.map((x) => <button key={x} className="btn sm" style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => ask(x)}>{x}</button>)}
              </div>
            )}
            {msgs.map((m, i) => <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : 'bot'}`}>{m.content}</div>)}
            {busy && <div className="ai-msg bot muted">Thinking…</div>}
            <div ref={end} />
          </div>
          <form className="ai-box" style={{ padding: 0, border: 0 }} onSubmit={(e) => { e.preventDefault(); ask(q) }}>
            <input id="ai-q" className="inp" placeholder="Ask a question" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn pri" aria-label="Send" disabled={busy}><Send /></button>
          </form>
        </Drawer>
      )}
    </>
  )
}
