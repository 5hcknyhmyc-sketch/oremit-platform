import { useNavigate } from 'react-router-dom'
import { LogOut, RotateCcw } from 'lucide-react'
import { Wordmark } from './ui'
import { useStore } from '../store'

export default function TopBar({ label, children }) {
  const nav = useNavigate()
  const logout = useStore((s) => s.logout)
  const reset = useStore((s) => s.reset)
  return (
    <header className="pbar">
      <Wordmark />
      {label && <span className="chip-dark">{label}</span>}
      <div className="spacer" />
      {children}
      <button className="btn sm" onClick={() => { if (window.confirm('Reset all demo data to the starting state?')) { reset(); nav('/') } }} title="Reset demo data"><RotateCcw />Reset demo</button>
      <button className="btn sm" onClick={() => { logout(); nav('/') }}><LogOut />Switch user</button>
    </header>
  )
}
