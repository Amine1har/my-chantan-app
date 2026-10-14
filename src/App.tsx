import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/lib/auth"
import ScrollToTop from "./components/ScrollToTop"
import Index from "./pages/Index"
import Dashboard from "./pages/Dashboard"
import Orders from "./pages/Orders"
import Customers from "./pages/Customers"
import Stock from "./pages/Stock"
import Accounting from "./pages/Accounting"
import Ledger from "./pages/Ledger"
import Ads from "./pages/Ads"
import Marketing from "./pages/Marketing"
import Integrations from "./pages/Integrations"
import Carriers from "./pages/Carriers"
import Expedition from "./pages/Expedition"
import Kpis from "./pages/Kpis"
import Team from "./pages/Team"
import StudioTemplates from "./pages/StudioTemplates"
import StudioHistory from "./pages/StudioHistory"
import NotFound from "./pages/NotFound"

const queryClient = new QueryClient()

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/tableau-de-bord" element={<Dashboard />} />
            <Route path="/commandes" element={<Orders />} />
            <Route path="/expedition" element={<Expedition />} />
            <Route path="/clients" element={<Customers />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/comptabilite" element={<Accounting />} />
            <Route path="/comptabilite-generale" element={<Ledger />} />
            <Route path="/publicites" element={<Ads />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/transporteurs" element={<Carriers />} />
            <Route path="/kpis" element={<Kpis />} />
            <Route path="/equipe" element={<Team />} />
            <Route path="/studio" element={<StudioTemplates />} />
            <Route path="/studio/templates" element={<StudioTemplates />} />
            <Route path="/studio/historique" element={<StudioHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
