"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic"
import { Cloud, CheckCircle, XCircle, AlertTriangle, Loader2, Save, Eye, EyeOff, Copy, Check, ChevronDown, ChevronUp, Database, ExternalLink } from "lucide-react"
import { resetSupabaseClient } from "@/lib/supabase"

interface SupabaseIntegrationPanelProps {
    supabaseUrl: string
    supabaseAnonKey: string
    onConfigChange: (field: string, value: string) => void
    onSave: () => Promise<void>
}

type ConnectionStatus = "idle" | "testing" | "connected" | "error" | "schema-missing"

// The consolidated SQL for Supabase setup
const SETUP_SQL = `-- ═══════════════════════════════════════════════════════════════════
-- OmniRad — Supabase Cloud Sync Setup
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  modality TEXT,
  urgency TEXT,
  report_status TEXT DEFAULT 'Pending',
  report_data JSONB NOT NULL,
  pacs_study_uid TEXT,
  pacs_series_uid TEXT,
  pacs_source TEXT
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_all_access" ON public.reports
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
  id TEXT PRIMARY KEY,
  patient_id_number TEXT,
  patient_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT,
  contact_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_all_access" ON public.patients
  FOR ALL USING (true) WITH CHECK (true);`

export function SupabaseIntegrationPanel({
    supabaseUrl,
    supabaseAnonKey,
    onConfigChange,
    onSave,
}: SupabaseIntegrationPanelProps) {
    const [showKey, setShowKey] = React.useState(false)
    const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatus>("idle")
    const [connectionMessage, setConnectionMessage] = React.useState("")
    const [reportCount, setReportCount] = React.useState<number | null>(null)
    const [patientsTableExists, setPatientsTableExists] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [saved, setSaved] = React.useState(false)
    const [showSql, setShowSql] = React.useState(false)
    const [copied, setCopied] = React.useState(false)

    // Auto-test on mount if credentials exist
    React.useEffect(() => {
        if (supabaseUrl?.trim() && supabaseAnonKey?.trim()) {
            testConnection(true)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const testConnection = async (silent = false) => {
        if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
            setConnectionStatus("error")
            setConnectionMessage("Enter both Project URL and Anon Key first.")
            return
        }

        setConnectionStatus("testing")
        setConnectionMessage("Testing connection...")

        try {
            const res = await fetch("/api/settings/test-supabase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    supabaseUrl: supabaseUrl.trim(),
                    supabaseAnonKey: supabaseAnonKey.trim(),
                }),
            })

            const data = await res.json()

            if (data.success && data.connected) {
                if (!data.reportsTableExists) {
                    setConnectionStatus("schema-missing")
                    setConnectionMessage(data.message || "Connected, but tables are missing. Run the SQL setup.")
                    setReportCount(null)
                    setPatientsTableExists(false)
                } else {
                    setConnectionStatus("connected")
                    setConnectionMessage(data.message || "Connected!")
                    setReportCount(data.reportCount ?? 0)
                    setPatientsTableExists(data.patientsTableExists ?? false)
                }
            } else {
                setConnectionStatus("error")
                setConnectionMessage(data.error || "Connection failed.")
                setReportCount(null)
                setPatientsTableExists(false)
            }
        } catch (err) {
            setConnectionStatus("error")
            setConnectionMessage(`Network error: ${err instanceof Error ? err.message : "Unknown"}`)
            setReportCount(null)
            setPatientsTableExists(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onSave()
            // Reset the cached Supabase client so new credentials take effect immediately
            resetSupabaseClient()
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
            // Re-test after save
            if (supabaseUrl?.trim() && supabaseAnonKey?.trim()) {
                setTimeout(() => testConnection(true), 500)
            } else {
                setConnectionStatus("idle")
                setConnectionMessage("")
                setReportCount(null)
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleCopySql = async () => {
        try {
            await navigator.clipboard.writeText(SETUP_SQL)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback for non-HTTPS contexts
            const ta = document.createElement("textarea")
            ta.value = SETUP_SQL
            document.body.appendChild(ta)
            ta.select()
            document.execCommand("copy")
            document.body.removeChild(ta)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const statusIcon = () => {
        switch (connectionStatus) {
            case "testing":
                return <Loader2 size={18} className="animate-spin text-blue-400" />
            case "connected":
                return <CheckCircle size={18} className="text-green-500" />
            case "error":
                return <XCircle size={18} className="text-red-500" />
            case "schema-missing":
                return <AlertTriangle size={18} className="text-yellow-500" />
            default:
                return <Cloud size={18} className="text-text-muted" />
        }
    }

    const statusColor = () => {
        switch (connectionStatus) {
            case "connected": return "border-green-500/30 bg-green-950/10"
            case "error": return "border-red-500/30 bg-red-950/10"
            case "schema-missing": return "border-yellow-500/30 bg-yellow-950/10"
            case "testing": return "border-blue-500/30 bg-blue-950/10"
            default: return "border-border-primary bg-bg-panel/50"
        }
    }

    const isConfigured = supabaseUrl?.trim() && supabaseAnonKey?.trim()

    return (
        <Card className="bg-bg-surface border-border-primary">
            <CardHeader>
                <CardTitle className="text-text-heading flex items-center gap-2">
                    <Cloud size={20} className="text-emerald-500" />
                    Supabase Cloud Sync
                </CardTitle>
                <p className="text-sm text-text-secondary">
                    Sync reports to the cloud for cross-device access. Images are auto-stripped before upload to save bandwidth.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* Connection Status Banner */}
                {connectionStatus !== "idle" && (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-300 ${statusColor()}`}>
                        {statusIcon()}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{connectionMessage}</p>
                            {connectionStatus === "connected" && reportCount !== null && (
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-text-muted flex items-center gap-1">
                                        <Database size={12} />
                                        {reportCount} report{reportCount !== 1 ? "s" : ""} synced
                                    </span>
                                    {!patientsTableExists && (
                                        <span className="text-xs text-yellow-500">• Patients table missing</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Project URL */}
                <div>
                    <Label htmlFor="supabaseUrl" className="text-text-primary">
                        Supabase Project URL *
                    </Label>
                    <Input
                        id="supabaseUrl"
                        type="url"
                        placeholder="https://your-project.supabase.co"
                        value={supabaseUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onConfigChange("supabaseUrl", e.target.value)}
                        className="mt-1 bg-bg-panel border-border-primary text-text-primary placeholder-text-muted"
                    />
                    <p className="text-xs text-text-muted mt-1">
                        Find this at <span className="text-text-secondary">Supabase Dashboard → Settings → API → Project URL</span>
                    </p>
                </div>

                {/* Anon Key */}
                <div>
                    <Label htmlFor="supabaseAnonKey" className="text-text-primary">
                        Anon Public Key *
                    </Label>
                    <div className="relative mt-1">
                        <Input
                            id="supabaseAnonKey"
                            type={showKey ? "text" : "password"}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            value={supabaseAnonKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onConfigChange("supabaseAnonKey", e.target.value)}
                            className="bg-bg-panel border-border-primary text-text-primary placeholder-text-muted pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                            title={showKey ? "Hide key" : "Show key"}
                        >
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                        Find this at <span className="text-text-secondary">Supabase Dashboard → Settings → API → anon public key</span>
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <Button
                        onClick={() => testConnection()}
                        disabled={connectionStatus === "testing" || !isConfigured}
                        variant="outline"
                        className="flex-1 gap-2 border-border-primary text-text-primary hover:bg-white/5"
                    >
                        {connectionStatus === "testing" ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Cloud size={16} />
                        )}
                        {connectionStatus === "testing" ? "Testing..." : "Test Connection"}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 bg-primary-main hover:bg-primary-hover text-white gap-2"
                    >
                        {saved ? <Check size={16} /> : <Save size={16} />}
                        {isSaving ? "Saving..." : saved ? "Saved!" : "Save"}
                    </Button>
                </div>

                {/* SQL Setup Section */}
                <div className="border-t border-border-primary pt-4">
                    <button
                        onClick={() => setShowSql(!showSql)}
                        className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors w-full text-left"
                    >
                        <Database size={16} className="text-emerald-500" />
                        <span className="flex-1">Database Setup SQL</span>
                        {showSql ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <p className="text-xs text-text-muted mt-1">
                        Run this SQL once in your Supabase SQL Editor to create the required tables.
                    </p>

                    {showSql && (
                        <div className="mt-3 space-y-2">
                            <div className="flex justify-between items-center">
                                <a
                                    href="https://supabase.com/dashboard"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                >
                                    Open Supabase Dashboard
                                    <ExternalLink size={12} />
                                </a>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCopySql}
                                    className="h-7 px-2.5 text-xs gap-1.5 border-border-primary text-text-secondary hover:text-text-primary hover:bg-white/5"
                                >
                                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                    {copied ? "Copied!" : "Copy SQL"}
                                </Button>
                            </div>
                            <pre className="text-xs bg-bg-primary border border-border-primary rounded-lg p-4 overflow-x-auto max-h-[300px] overflow-y-auto text-text-secondary font-mono leading-relaxed">
                                {SETUP_SQL}
                            </pre>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
