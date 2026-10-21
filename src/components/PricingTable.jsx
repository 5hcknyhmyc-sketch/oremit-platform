import { CURRENCIES } from '../lib/reference'
import { corridorFee } from '../lib/engine'
import { gbp2 } from '../lib/util'

export const DEFAULT_PRICING = { margin: 1.1, threshold: 100, fee: 2.49, feePct: 0, aboveFee: 0, aboveFeePct: 0 }

// One row per corridor. Pricing per corridor: FX margin, and two fee bands split at a threshold —
// below it fixed £ + %, at/above it fixed £ + % (default nothing, so larger transfers pay only the FX margin).
export default function PricingTable({ rows, onChange, extra, readOnly }) {
  const upd = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const cell = (i, k, w = 72) => <input className="inp num" style={{ width: w }} disabled={readOnly} value={rows[i][k] ?? ''} onChange={(e) => upd(i, k, e.target.value)} aria-label={`${k} for ${rows[i].cur}`} />
  const sample = (r) => [50, 500].map((a) => { const f = corridorFee(r, a).fee; return `£${a} → ${f ? gbp2(f) : 'no fee'}` }).join(' · ')
  return (
    <div className="tbl-wrap"><table className="pricing">
      <thead><tr>{extra && <th>On</th>}<th>Corridor</th><th className="r">Partner rate</th><th>FX margin %</th><th>Split at £</th><th colSpan={2}>Below: fixed £ + %</th><th colSpan={2}>At / above: fixed £ + %</th><th>Customer pays</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.cur}>
        {extra && <td>{extra(r, i)}</td>}
        <td className="mono nowrap">GBP → {r.cur} <span className="muted small">{CURRENCIES[r.cur]?.country}</span></td>
        <td className="r num">{CURRENCIES[r.cur]?.rate}</td>
        <td>{cell(i, 'margin', 64)}</td>
        <td>{cell(i, 'threshold', 72)}</td>
        <td>{cell(i, 'fee', 64)}</td><td>{cell(i, 'feePct', 56)}</td>
        <td>{cell(i, 'aboveFee', 64)}</td><td>{cell(i, 'aboveFeePct', 56)}</td>
        <td className="small muted nowrap">{sample(r)}</td>
      </tr>)}</tbody>
    </table></div>
  )
}

export const PricingHint = () => <span className="hint">Leave <b>Split at</b> blank or 0 to use the "below" fee for every amount. Example: split £100, below £3 + 1%, above £0 + 0% means a £50 transfer pays £3.50 and a £500 transfer pays no fee, just your FX margin.</span>
