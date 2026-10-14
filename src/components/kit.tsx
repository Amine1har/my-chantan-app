import type { ReactNode } from "react"
import { X } from "lucide-react"

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5 mb-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1 max-w-xl">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4" onClick={onClose}>
      <div className={`mt-10 w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-lg bg-background p-6 border border-border`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function Fig({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="border-t border-border pt-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  )
}

export const Empty = ({ text }: { text: string }) => <div className="py-12 text-center text-sm text-muted-foreground border-t border-border">{text}</div>
