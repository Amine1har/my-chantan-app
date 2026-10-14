import { useState } from "react"
import Shell from "@/components/Shell"
import { PageHead } from "@/components/kit"
import Saisie from "@/components/ledger/Saisie"
import Balance from "@/components/ledger/Balance"
import Consultation from "@/components/ledger/Consultation"
import ImportCsv from "@/components/ledger/ImportCsv"
import PlanPeriods from "@/components/ledger/PlanPeriods"
import { useLedger } from "@/lib/ledger"

const TABS = [
  { k: "saisie", l: "Saisie comptable" },
  { k: "balance", l: "Balance générale" },
  { k: "consultation", l: "Consultation des comptes" },
  { k: "import", l: "Import CSV" },
  { k: "plan", l: "Plan comptable & périodes" },
]

export default function Ledger() {
  const [tab, setTab] = useState("saisie")
  const L = useLedger()
  return (
    <Shell>
      <PageHead title="Comptabilité générale" sub="Comptabilité en partie double : écritures, centres de coûts et de profit, clôture de période et balance générale." />
      <div className="flex flex-wrap gap-2 mb-8 print:hidden">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${tab === t.k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{t.l}</button>
        ))}
      </div>
      {L.loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
        <>
          {tab === "saisie" && <Saisie {...L} />}
          {tab === "balance" && <Balance {...L} />}
          {tab === "consultation" && <Consultation {...L} />}
          {tab === "import" && <ImportCsv {...L} />}
          {tab === "plan" && <PlanPeriods {...L} />}
        </>
      )}
    </Shell>
  )
}
