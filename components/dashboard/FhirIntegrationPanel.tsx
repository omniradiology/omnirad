"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic"
import { Save, Link, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"

export function FhirIntegrationPanel() {
    const [loading, setLoading] = React.useState(true)
    const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle")
    const [errorMsg, setErrorMsg] = React.useState("")
    const [connStatus, setConnStatus] = React.useState<"idle" | "checking" | "verified" | "invalid">("idle")
    const [connError, setConnError] = React.useState("")
    const [serverInfo, setServerInfo] = React.useState({ fhirVersion: "", softwareName: "" })

    const [formData, setFormData] = React.useState({
        enabled: false,
        publicBaseUrl: "",
        authMode: "bearer_token",
        inboundServiceRequestEnabled: false,
        outboundReadEnabled: true,
        externalFhirBaseUrl: "",
        externalFhirAuthType: "none",
        externalFhirClientId: "",
        externalFhirClientSecret: "",
        externalFhirBearerToken: "",
    })

    React.useEffect(() => {
        fetch("/api/fhir/config")
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setFormData(prev => ({ ...prev, ...data }))
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target
        const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value
        setFormData(prev => ({ ...prev, [id]: val }))
        
        if (id === "externalFhirBaseUrl" || id === "externalFhirAuthType" || id === "externalFhirBearerToken" || id === "externalFhirClientId" || id === "externalFhirClientSecret") {
            setConnStatus("idle")
        }
        setSaveStatus("idle")
    }

    const checkConnection = async () => {
        if (!formData.externalFhirBaseUrl) {
            setConnStatus("invalid")
            setConnError("FHIR Base URL is required.")
            return
        }

        setConnStatus("checking")
        setConnError("")
        try {
            const res = await fetch("/api/fhir/config/test-connection", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setServerInfo({ fhirVersion: data.fhirVersion, softwareName: data.softwareName })
                setConnStatus("verified")
            } else {
                setConnStatus("invalid")
                setConnError(data.error || "Failed to connect to FHIR server.")
            }
        } catch(e) {
            setConnStatus("invalid")
            setConnError("Network error while trying to reach the test connection endpoint.")
        }
    }

    const handleSave = async () => {
        if (formData.enabled && !formData.externalFhirBaseUrl) {
            setErrorMsg("External FHIR Base URL is required when enabled.")
            setSaveStatus("error")
            return
        }

        setSaveStatus("saving")
        setErrorMsg("")
        try {
            const res = await fetch("/api/fhir/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })
            const result = await res.json()
            if (res.ok && result.success) {
                setSaveStatus("saved")
                setTimeout(() => setSaveStatus("idle"), 3000)
            } else {
                setErrorMsg(result.error || "Failed to save FHIR configuration")
                setSaveStatus("error")
            }
        } catch (e) {
            setErrorMsg(String(e))
            setSaveStatus("error")
        }
    }

    if (loading) return null

    return (
        <Card className="bg-bg-surface border-border-primary border-t-4 border-t-emerald-500">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-text-heading flex items-center gap-2">
                            <Link size={20} className="text-emerald-500" />
                            FHIR API Integration
                        </CardTitle>
                        <p className="text-sm text-text-secondary mt-1">Connect to external EMR/EHR systems and enable standard FHIR workflows</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="enabled" className="text-sm font-medium text-text-primary cursor-pointer">Enable FHIR Integration</Label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="enabled"
                                className="sr-only peer"
                                checked={formData.enabled}
                                onChange={handleChange}
                            />
                            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </CardHeader>
            <CardContent className={`space-y-5 transition-opacity duration-300 ${formData.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* External FHIR Base URL */}
                    <div className="col-span-1 md:col-span-2">
                        <Label htmlFor="externalFhirBaseUrl" className="text-text-primary">External FHIR Base URL *</Label>
                        <Input
                            id="externalFhirBaseUrl"
                            value={formData.externalFhirBaseUrl}
                            onChange={handleChange}
                            placeholder="https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/"
                            className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                        />
                    </div>

                    {/* Authentication Type */}
                    <div>
                        <Label htmlFor="externalFhirAuthType" className="text-text-primary">Authentication Type</Label>
                        <select
                            id="externalFhirAuthType"
                            value={formData.externalFhirAuthType}
                            onChange={handleChange}
                            className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                            <option value="none">None / Open Endpoint</option>
                            <option value="basic">Basic (Client ID / Secret)</option>
                            <option value="bearer">Bearer Token</option>
                        </select>
                    </div>

                    {/* Authentication Details based on type */}
                    {formData.externalFhirAuthType === "basic" && (
                        <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="externalFhirClientId" className="text-text-primary">Client ID (Username)</Label>
                                <Input
                                    id="externalFhirClientId"
                                    value={formData.externalFhirClientId}
                                    onChange={handleChange}
                                    className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                                />
                            </div>
                            <div>
                                <Label htmlFor="externalFhirClientSecret" className="text-text-primary">Client Secret (Password)</Label>
                                <Input
                                    id="externalFhirClientSecret"
                                    type="password"
                                    value={formData.externalFhirClientSecret}
                                    onChange={handleChange}
                                    className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                                />
                            </div>
                        </div>
                    )}

                    {formData.externalFhirAuthType === "bearer" && (
                        <div className="col-span-1 md:col-span-2">
                            <Label htmlFor="externalFhirBearerToken" className="text-text-primary">Bearer Token</Label>
                            <Input
                                id="externalFhirBearerToken"
                                type="password"
                                value={formData.externalFhirBearerToken}
                                onChange={handleChange}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                            />
                        </div>
                    )}

                    {/* Test Connection Button */}
                    <div className="col-span-1 md:col-span-2 mt-2">
                        <Button 
                            variant="outline" 
                            onClick={(e) => { e.preventDefault(); checkConnection(); }}
                            disabled={connStatus === "checking"}
                            className="w-full border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-2 disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={connStatus === "checking" ? "animate-spin" : ""} />
                            {connStatus === "checking" ? "Connecting to FHIR Server..." : "Test FHIR Connection"}
                        </Button>
                    </div>

                    {connStatus === "invalid" && (
                        <div className="col-span-1 md:col-span-2 text-xs text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20">
                            <strong>Connection Failed:</strong> {connError}
                        </div>
                    )}

                    {connStatus === "verified" && (
                        <div className="col-span-1 md:col-span-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-md border border-emerald-500/20 flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 font-medium">
                                <CheckCircle size={14} /> Connection Verified Successfully!
                            </div>
                            <div className="pl-5 opacity-90">
                                Server: <strong>{serverInfo.softwareName}</strong> (FHIR Version: <strong>{serverInfo.fhirVersion}</strong>)
                            </div>
                        </div>
                    )}

                    <div className="col-span-1 md:col-span-2 pt-2 pb-2">
                        <div className="border-t border-border-primary"></div>
                    </div>

                    {/* Feature Toggles */}
                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-border-primary">
                            <div className="flex items-center h-5 mt-0.5">
                                <input
                                    id="inboundServiceRequestEnabled"
                                    type="checkbox"
                                    checked={formData.inboundServiceRequestEnabled}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 dark:focus:ring-emerald-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                                />
                            </div>
                            <div className="text-sm">
                                <label htmlFor="inboundServiceRequestEnabled" className="font-medium text-text-primary">Enable Inbound Service Requests</label>
                                <p className="text-text-muted mt-1 text-xs">Allow external systems to create ServiceRequest orders in OmniRad via API.</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-border-primary">
                            <div className="flex items-center h-5 mt-0.5">
                                <input
                                    id="outboundReadEnabled"
                                    type="checkbox"
                                    checked={formData.outboundReadEnabled}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 dark:focus:ring-emerald-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                                />
                            </div>
                            <div className="text-sm">
                                <label htmlFor="outboundReadEnabled" className="font-medium text-text-primary">Enable Outbound Lookups</label>
                                <p className="text-text-muted mt-1 text-xs">Allow OmniRad to fetch Patient demographics and previous DiagnosticReports from the external server.</p>
                            </div>
                        </div>
                    </div>

                    {/* Additional Local FHIR Auth Config (Inbound) */}
                    <div className="col-span-1 md:col-span-2 mt-4 space-y-4">
                        <h4 className="text-sm font-medium text-text-primary mb-2">Local API Authentication (Inbound)</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="authMode" className="text-text-primary">Inbound Authentication Mode</Label>
                                <select
                                    id="authMode"
                                    value={formData.authMode}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                >
                                    <option value="none">No Auth (Not Recommended)</option>
                                    <option value="bearer_token">Bearer Token</option>
                                </select>
                            </div>
                            
                            <div>
                                <Label htmlFor="publicBaseUrl" className="text-text-primary">Public Base URL</Label>
                                <Input
                                    id="publicBaseUrl"
                                    value={formData.publicBaseUrl}
                                    onChange={handleChange}
                                    placeholder="https://omnirad.yourdomain.com"
                                    className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                                />
                                <p className="text-[11px] text-text-muted mt-1">Used for webhook callbacks and self-referencing URLs.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {saveStatus === "error" && errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 dark:text-red-400 text-sm">
                        <AlertCircle size={16} /> {errorMsg}
                    </div>
                )}

                {saveStatus === "saved" && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                        <CheckCircle size={16} /> FHIR Configuration saved successfully!
                    </div>
                )}

                <Button
                    onClick={handleSave}
                    disabled={saveStatus === "saving"}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:opacity-50"
                >
                    <Save size={16} />
                    {saveStatus === "saving" ? "Saving..." : "Save FHIR Configuration"}
                </Button>
            </CardContent>
        </Card>
    )
}
