"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic"
import { Save, MessageSquare, CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react"

export function CopilotConfigPanel() {
    const [loading, setLoading] = React.useState(true)
    const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle")
    const [errorMsg, setErrorMsg] = React.useState("")
    const [isLocked, setIsLocked] = React.useState(false)

    // Connection state
    const [connStatus, setConnStatus] = React.useState<"idle" | "checking" | "verified" | "invalid">("idle")
    const [connError, setConnError] = React.useState("")
    const [availableModels, setAvailableModels] = React.useState<string[]>([])
    const [showDropdown, setShowDropdown] = React.useState(false)
    const [showApiKey, setShowApiKey] = React.useState(false)

    const [formData, setFormData] = React.useState({
        providerType: "custom_api",
        apiEndpointUrl: "https://openrouter.ai/api/v1",
        apiSecretKey: "",
        modelName: "",
        maxTokens: 4096,
        temperature: 0.3,
        isActive: true,
        purpose: "copilot",
        langsmithApiKey: "",
        langsmithProject: "omnirad-copilot",
    })

    React.useEffect(() => {
        // Load copilot-specific config
        fetch("/api/ai-config?purpose=copilot")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const active = data.find((d: any) => d.purpose === "copilot" && d.isActive) || data.find((d: any) => d.purpose === "copilot") || null
                    if (active) {
                        setFormData({
                            providerType: active.providerType || "custom_api",
                            apiEndpointUrl: active.apiEndpointUrl || "",
                            apiSecretKey: active.apiSecretKey || "",
                            modelName: active.modelName || "",
                            maxTokens: active.maxTokens || 4096,
                            temperature: active.temperature || 0.3,
                            isActive: true,
                            purpose: "copilot",
                            langsmithApiKey: active.langsmithApiKey || "",
                            langsmithProject: active.langsmithProject || "omnirad-copilot",
                        })
                        if (active.apiEndpointUrl && (active.apiSecretKey || active.providerType === "ollama")) {
                            checkConnection(active.providerType, active.apiEndpointUrl, active.apiSecretKey)
                            setIsLocked(true)
                        }
                    }
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target
        const fieldName = id.replace("copilot_", "")
        setFormData(prev => ({ ...prev, [fieldName]: value }))

        if (fieldName === "apiEndpointUrl" || fieldName === "apiSecretKey" || fieldName === "providerType") {
            setConnStatus("idle")
            setAvailableModels([])
            if (fieldName === "providerType") {
                if (value === "ollama") {
                    setFormData(prev => ({ ...prev, providerType: value, apiEndpointUrl: "http://localhost:11434", modelName: "" }))
                } else if (value === "custom_api") {
                    setFormData(prev => ({ ...prev, providerType: value, apiEndpointUrl: "https://openrouter.ai/api/v1", modelName: "" }))
                }
            }
        }
        setSaveStatus("idle")
    }

    const checkConnection = async (type = formData.providerType, url = formData.apiEndpointUrl, key = formData.apiSecretKey) => {
        setConnStatus("checking")
        setConnError("")
        try {
            const res = await fetch("http://localhost:8001/test_ai_connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ai_config: { providerType: type, apiEndpointUrl: url, apiSecretKey: key } })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setAvailableModels(data.models || [])
                setConnStatus("verified")
            } else {
                setConnStatus("invalid")
                setConnError(data.error || "Failed to fetch models.")
            }
        } catch {
            setConnStatus("invalid")
            setConnError("Ensure the Python backend is running.")
        }
    }

    const handleSave = async () => {
        if (!formData.apiEndpointUrl) { setErrorMsg("Endpoint URL is required."); setSaveStatus("error"); return }
        if (formData.providerType !== "ollama" && !formData.apiSecretKey) { setErrorMsg("API Key is required."); setSaveStatus("error"); return }
        if (!formData.modelName) { setErrorMsg("Select a model first."); setSaveStatus("error"); return }

        setSaveStatus("saving")
        setErrorMsg("")
        try {
            const res = await fetch("/api/ai-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, purpose: "copilot" }),
            })
            const result = await res.json()
            if (res.ok && result.success) {
                setSaveStatus("saved")
                setIsLocked(true)
                setTimeout(() => setSaveStatus("idle"), 3000)
            } else {
                setErrorMsg(result.error || "Failed to save")
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
                <CardTitle className="text-text-heading flex items-center gap-2">
                    <MessageSquare size={20} className="text-emerald-500" />
                    AI Copilot Chat Configuration
                </CardTitle>
                <p className="text-sm text-text-secondary">
                    Configure a separate AI model for the Copilot chat assistant. This can be a different model from report generation.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* Provider Type */}
                <div>
                    <Label htmlFor="copilot_providerType" className="text-text-primary">Provider Type</Label>
                    <select
                        id="copilot_providerType"
                        value={formData.providerType}
                        onChange={handleChange}
                        disabled={isLocked}
                        className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel disabled:opacity-50 px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                        <option value="custom_api">Custom API (OpenAI / OpenRouter / etc.)</option>
                        <option value="ollama">Ollama (Local Models)</option>
                    </select>
                </div>

                {/* Endpoint URL */}
                <div>
                    <Label htmlFor="copilot_apiEndpointUrl" className="text-text-primary">API Endpoint URL</Label>
                    <Input
                        id="copilot_apiEndpointUrl"
                        value={formData.apiEndpointUrl}
                        onChange={handleChange}
                        disabled={isLocked}
                        placeholder={formData.providerType === "ollama" ? "http://localhost:11434" : "https://openrouter.ai/api/v1"}
                        className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50"
                    />
                </div>

                {/* API Key */}
                {formData.providerType !== "ollama" && (
                    <div>
                        <Label htmlFor="copilot_apiSecretKey" className="text-text-primary">API Secret Key</Label>
                        <div className="relative mt-1">
                            <Input
                                id="copilot_apiSecretKey"
                                type={showApiKey ? "text" : "password"}
                                value={formData.apiSecretKey}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="Enter your API key"
                                className="bg-bg-panel border-border-primary text-text-primary disabled:opacity-50 pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                            >
                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Check Connection */}
                <Button
                    variant="outline"
                    onClick={() => checkConnection()}
                    disabled={connStatus === "checking" || isLocked}
                    className="w-full border-emerald-500 text-emerald-500 hover:bg-emerald-50 gap-2 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={connStatus === "checking" ? "animate-spin" : ""} />
                    {connStatus === "checking" ? "Connecting..." : "Check Connection & Fetch Models"}
                </Button>

                {connStatus === "invalid" && (
                    <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                        <strong>Connection Failed:</strong> {connError}
                    </div>
                )}
                {connStatus === "verified" && (
                    <div className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded-md border border-green-500/20 flex items-center gap-1.5">
                        <CheckCircle size={14} /> <strong>Connection Verified:</strong> {availableModels.length} models available.
                    </div>
                )}

                <div className="pt-2 border-t border-border-primary"></div>

                {/* Model Selection */}
                <div className="relative">
                    <Label htmlFor="copilot_modelName" className="text-text-primary">Model Name</Label>
                    <div className="relative mt-1">
                        <Input
                            id="copilot_modelName"
                            value={formData.modelName}
                            onChange={(e) => { handleChange(e); setShowDropdown(true) }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                            disabled={connStatus !== "verified" || isLocked}
                            placeholder={connStatus === "verified" ? "Type or select a model..." : "Check connection first..."}
                            className="bg-bg-panel border-border-primary text-text-primary pr-10 disabled:opacity-50"
                            autoComplete="off"
                        />
                        {connStatus === "verified" && !isLocked && (
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); setShowDropdown(!showDropdown) }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                            >
                                {showDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                    </div>
                    {showDropdown && connStatus === "verified" && availableModels.length > 0 && (
                        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border-primary bg-bg-panel py-1 text-sm shadow-xl">
                            {(availableModels.includes(formData.modelName)
                                ? availableModels
                                : availableModels.filter(m => m.toLowerCase().includes(formData.modelName.toLowerCase()))
                            ).map(name => (
                                <li
                                    key={name}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        setFormData(prev => ({ ...prev, modelName: name }))
                                        setShowDropdown(false)
                                    }}
                                    className="cursor-pointer px-3 py-2 text-text-primary hover:bg-slate-200 dark:hover:bg-emerald-600/30"
                                >
                                    {name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="pt-2 border-t border-border-primary"></div>

                {/* LangSmith Configuration */}
                <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-2">
                        <span className="group-open:rotate-90 transition-transform">▸</span>
                        LangSmith Tracing (Optional)
                    </summary>
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-emerald-500/20">
                        <div>
                            <Label htmlFor="copilot_langsmithApiKey" className="text-text-primary text-xs">LangSmith API Key</Label>
                            <Input
                                id="copilot_langsmithApiKey"
                                type="password"
                                value={formData.langsmithApiKey}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="lsv2_pt_..."
                                className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50 text-sm"
                            />
                        </div>
                        <div>
                            <Label htmlFor="copilot_langsmithProject" className="text-text-primary text-xs">LangSmith Project Name</Label>
                            <Input
                                id="copilot_langsmithProject"
                                value={formData.langsmithProject}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="omnirad-copilot"
                                className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50 text-sm"
                            />
                        </div>
                    </div>
                </details>

                {/* Status messages */}
                {saveStatus === "error" && errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle size={16} /> {errorMsg}
                    </div>
                )}
                {saveStatus === "saved" && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle size={16} /> Copilot configuration saved and activated!
                    </div>
                )}

                {/* Save / Change button */}
                {isLocked ? (
                    <Button onClick={() => setIsLocked(false)} className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white gap-2">
                        <CheckCircle size={16} /> Change Configuration
                    </Button>
                ) : (
                    <Button
                        onClick={handleSave}
                        disabled={saveStatus === "saving" || connStatus !== "verified" || !formData.modelName}
                        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saveStatus === "saving" ? "Saving..." : "Save & Activate Copilot"}
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
