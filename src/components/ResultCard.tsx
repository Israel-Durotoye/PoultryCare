import React from 'react'
import { CheckCircle2, AlertTriangle, ShieldCheck, Activity, Stethoscope } from 'lucide-react'

export interface DiagnosisResult {
  label: string
  status: 'healthy' | 'unhealthy'
  confidence: number
  description: string
}

interface ResultCardProps {
  title: string
  result: DiagnosisResult
}

const labelMapping: Record<string, { title: string; subtitle: string; advice: string }> = {
  healthy: {
    title: "Healthy Flock",
    subtitle: "No abnormalities detected",
    advice: "Maintain regular biosecurity, keep water and feed fresh, and ensure proper coop ventilation."
  },
  unhealthy: {
    title: "Unhealthy Signals Detected",
    subtitle: "Needs further observation",
    advice: "Audio analysis indicates possible respiratory distress or atypical vocalization. Please perform a stool sample scan."
  },
  cocci: {
    title: "Coccidiosis Flagged",
    subtitle: "Intestinal parasitic infection detected",
    advice: "Isolate the bird immediately. Administer anticoccidial treatments (e.g., Amprolium) in drinking water. Clean and dry the bedding."
  },
  ncd: {
    title: "Newcastle Disease (NCD) Flagged",
    subtitle: "Highly contagious viral disease detected",
    advice: "Quarantine infected birds immediately. Limit coop access to prevent transmission. Contact your licensed poultry veterinarian immediately."
  },
  salmo: {
    title: "Salmonella Flagged",
    subtitle: "Bacterial gastrointestinal infection detected",
    advice: "Isolate affected birds. Disinfect all feeders and waterers. Practice strict hygiene to avoid transmission to humans (zoonotic danger)."
  }
}

export default function ResultCard({ title, result }: ResultCardProps) {
  const isHealthy = result.status === 'healthy'
  const confidencePercent = Math.min(Math.max(result.confidence * 100, 0), 100)
  
  const normalizedKey = result.label.toLowerCase()
  const info = labelMapping[normalizedKey] || {
    title: result.label,
    subtitle: "Diagnostic alert",
    advice: "Consult a veterinarian to confirm the diagnosis and establish a treatment plan."
  }

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 shadow-elegant transition-all duration-300 animate-fade-in-up bg-card
        ${isHealthy 
          ? 'border-success/30 hover:border-success/50 bg-success/[0.01]' 
          : 'border-destructive/30 hover:border-destructive/50 bg-destructive/[0.01]'
        }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            {title}
          </span>
          <h3 className="text-lg font-extrabold text-foreground mt-0.5 tracking-tight">{info.title}</h3>
          <p className="text-xs text-muted-foreground">{info.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {isHealthy ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Healthy Status
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold animate-pulse">
              <AlertTriangle className="h-4 w-4" />
              Requires Care
            </div>
          )}
        </div>
      </div>

      <div className="py-4 space-y-4">
        {/* Confidence bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> AI Confidence
            </span>
            <span className={`font-bold ${isHealthy ? 'text-success' : 'text-destructive'}`}>
              {confidencePercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out
                ${isHealthy ? 'bg-success shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.4)]'}
              `}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* Description */}
        <div className="rounded-2xl bg-muted/40 p-4 border border-border/40">
          <p className="text-sm text-foreground/90 leading-relaxed italic">
            "{result.description}"
          </p>
        </div>

        {/* Actionable advice */}
        <div className={`rounded-2xl p-4 border ${isHealthy ? 'bg-success/5 border-success/20 text-success' : 'bg-destructive/5 border-destructive/20 text-destructive'}`}>
          <div className="flex items-start gap-2.5">
            <Stethoscope className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Recommended Actions</h4>
              <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                {info.advice}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export { ResultCard }
