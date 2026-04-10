"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic"
import { Save, BrainCircuit, Activity, CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"

export function AIConfigPanel() {
    const [loading, setLoading] = React.useState(true)
    const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle")
    const [errorMsg, setErrorMsg] = React.useState("")
    const [backendStatus, setBackendStatus] = React.useState<"checking" | "connected" | "disconnected">("checking")
    const [isLocked, setIsLocked] = React.useState(false)
    
    // Connection specific state
    const [connStatus, setConnStatus] = React.useState<"idle" | "checking" | "verified" | "invalid">("idle")
    const [connError, setConnError] = React.useState("")
    const [availableModels, setAvailableModels] = React.useState<string[]>([])
    const [showDropdown, setShowDropdown] = React.useState(false)

    const [formData, setFormData] = React.useState({
        providerType: "custom_api",
        apiEndpointUrl: "https://openrouter.ai/api/v1",
        apiSecretKey: "",
        modelName: "",
        maxTokens: 4096,
        temperature: 0.3,
        isActive: true,
    })

    React.useEffect(() => {
        fetch("/api/ai-config")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const active = data.find((d: any) => d.isActive) || data[0]
                    setFormData({
                        providerType: active.providerType || "custom_api",
                        apiEndpointUrl: active.apiEndpointUrl || "",
                        apiSecretKey: active.apiSecretKey || "", 
                        modelName: active.modelName || "",
                        maxTokens: active.maxTokens || 4096,
                        temperature: active.temperature || 0.3,
                        isActive: true,
                    })
                    if (active.apiEndpointUrl && active.apiSecretKey) {
                        checkConnection(active.providerType, active.apiEndpointUrl, active.apiSecretKey)
                        setIsLocked(true)
                    }
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))

        // Check backend health
        fetch("http://localhost:8000/health")
            .then(res => {
                if (res.ok) setBackendStatus("connected")
                else setBackendStatus("disconnected")
            })
            .catch(() => setBackendStatus("disconnected"))
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target
        setFormData(prev => ({ ...prev, [id]: value }))
        
        // If they change endpoint or key, reset the connection state to force a re-check
        if (id === "apiEndpointUrl" || id === "apiSecretKey" || id === "providerType") {
            setConnStatus("idle")
            setAvailableModels([])
            if (id === "providerType") {
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
            const payload = {
                ai_config: { providerType: type, apiEndpointUrl: url, apiSecretKey: key }
            }
            const res = await fetch("http://localhost:8000/test_ai_connection", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setAvailableModels(data.models || [])
                setConnStatus("verified")
            } else {
                setConnStatus("invalid")
                setConnError(data.error || "Failed to fetch models.")
            }
        } catch(e) {
            setConnStatus("invalid")
            setConnError("Ensure the Python Global Backend is running.")
        }
    }

    const handleSave = async () => {
        if (!formData.apiEndpointUrl) {
            setErrorMsg("Endpoint URL is required.")
            setSaveStatus("error")
            return
        }
        if (formData.providerType !== "ollama" && !formData.apiSecretKey) {
            setErrorMsg("API Secret Key is required.")
            setSaveStatus("error")
            return
        }
        if (!formData.modelName) {
            setErrorMsg("Please check connection and select a Model Name.")
            setSaveStatus("error")
            return
        }

        setSaveStatus("saving")
        setErrorMsg("")
        try {
            const res = await fetch("/api/ai-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })
            const result = await res.json()
            if (res.ok && result.success) {
                setSaveStatus("saved")
                setIsLocked(true)
                setTimeout(() => setSaveStatus("idle"), 3000)
            } else {
                setErrorMsg(result.error || "Failed to save configuration")
                setSaveStatus("error")
            }
        } catch (e) {
            setErrorMsg(String(e))
            setSaveStatus("error")
        }
    }

    if (loading) return null

    return (
        <Card className="bg-bg-surface border-border-primary border-t-4 border-t-indigo-500">
            <CardHeader>
                <CardTitle className="text-text-heading flex items-center gap-2">
                    <BrainCircuit size={20} className="text-indigo-500" />
                    AI LangGraph Engine Configuration
                </CardTitle>
                <p className="text-sm text-text-secondary">Configure your AI Provider and select a model for report generation</p>
            </CardHeader>
            <CardContent className="space-y-5">
                
                {/* 1. Provider Type */}
                <div>
                    <Label htmlFor="providerType" className="text-text-primary">Provider Type</Label>
                    <select
                        id="providerType"
                        value={formData.providerType}
                        onChange={handleChange}
                        disabled={isLocked}
                        className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel disabled:opacity-50 px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <option value="custom_api">Custom API</option>
                        <option value="ollama">Ollama (Local Models)</option>
                    </select>
                </div>

                {/* 2. Endpoint URL */}
                <div>
                    <Label htmlFor="apiEndpointUrl" className="text-text-primary">API Endpoint URL</Label>
                    <Input
                        id="apiEndpointUrl"
                        value={formData.apiEndpointUrl}
                        onChange={handleChange}
                        disabled={isLocked}
                        placeholder={formData.providerType === "ollama" ? "http://localhost:11434" : "https://openrouter.ai/api/v1"}
                        className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50"
                    />
                </div>

                {/* 3. API Secret Key */}
                {formData.providerType !== "ollama" && (
                    <div>
                        <Label htmlFor="apiSecretKey" className="text-text-primary">API Secret Key</Label>
                        <div className="mt-1">
                            <Input
                                id="apiSecretKey"
                                type="password"
                                value={formData.apiSecretKey}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="Enter your API key"
                                className="bg-bg-panel border-border-primary text-text-primary disabled:opacity-50"
                            />
                        </div>
                    </div>
                )}

                {/* 4. Check Connection Button */}
                <Button 
                    variant="outline" 
                    onClick={() => checkConnection()}
                    disabled={connStatus === "checking" || isLocked}
                    className="w-full border-indigo-500 text-indigo-500 hover:bg-indigo-50 gap-2 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={connStatus === "checking" ? "animate-spin" : ""} />
                    {connStatus === "checking" ? "Connecting to Provider..." : "Check Connection & Fetch Models"}
                </Button>
                
                {connStatus === "invalid" && (
                    <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                        <strong>Connection Failed:</strong> {connError}
                    </div>
                )}

                {connStatus === "verified" && (
                    <div className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded-md border border-green-500/20 flex items-center gap-1.5">
                        <CheckCircle size={14} /> <strong>Connection Verified:</strong> Successfully fetched {availableModels.length} models.
                    </div>
                )}

                <div className="pt-2 border-t border-border-primary"></div>

                {/* 5. Model Name (Select or type manually) */}
                {/* 5. Model Name (Select or type manually) */}
                <div className="relative">
                    <Label htmlFor="modelName" className="text-text-primary">Model Name</Label>
                    <div className="relative mt-1">
                        <Input
                            id="modelName"
                            value={formData.modelName}
                            onChange={(e) => {
                                handleChange(e)
                                setShowDropdown(true)
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                            disabled={connStatus !== "verified" || isLocked}
                            placeholder={connStatus === "verified" ? "Type or select a model..." : "Waiting for connection check..."}
                            className="bg-bg-panel border-border-primary text-text-primary pr-10 disabled:opacity-50"
                            autoComplete="off"
                        />
                        {connStatus === "verified" && !isLocked && (
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault() // prevent input from losing focus
                                    setShowDropdown(!showDropdown)
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                            >
                                {showDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                    </div>
                    
                    {/* Custom Dropdown Menu */}
                    {showDropdown && connStatus === "verified" && availableModels.length > 0 && (
                        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border-primary bg-bg-panel py-1 text-sm shadow-xl hide-scrollbar">
                            {(availableModels.includes(formData.modelName) 
                                ? availableModels 
                                : availableModels.filter(m => m.toLowerCase().includes(formData.modelName.toLowerCase()))
                            ).map(name => (
                                <li
                                    key={name}
                                    onMouseDown={(e) => {
                                        // onMouseDown fires before onBlur
                                        e.preventDefault()
                                        setFormData(prev => ({ ...prev, modelName: name }))
                                        setShowDropdown(false)
                                    }}
                                    className="cursor-pointer px-3 py-2 text-text-primary hover:bg-slate-200 dark:hover:bg-indigo-600/40"
                                >
                                    {name}
                                </li>
                            ))}
                            {!availableModels.includes(formData.modelName) && availableModels.filter(m => m.toLowerCase().includes(formData.modelName.toLowerCase())).length === 0 && (
                                <li className="px-3 py-2 text-text-muted">No matching models found</li>
                            )}
                        </ul>
                    )}
                </div>

                {saveStatus === "error" && errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle size={16} /> {errorMsg}
                    </div>
                )}

                {saveStatus === "saved" && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle size={16} /> Configuration saved and activated successfully!
                    </div>
                )}

                {/* Save / Change button */}
                {isLocked ? (
                    <Button
                        onClick={() => setIsLocked(false)}
                        className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        <CheckCircle size={16} />
                        Change Configuration
                    </Button>
                ) : (
                    <Button
                        onClick={handleSave}
                        disabled={saveStatus === "saving" || connStatus !== "verified" || !formData.modelName}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved Active Configuration!" : "Save & Activate Provider"}
                    </Button>
                )}

                {/* Python Dependency Badge */}
                <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/30 rounded-lg flex items-center justify-between text-indigo-800 dark:text-indigo-300">
                     <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-3">
                             <span className="flex items-center gap-2 text-sm font-medium"><Activity size={16} /> Python Local DeepAgents Backend</span>
                             {backendStatus === "checking" && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full animate-pulse">Checking...</span>}
                             {backendStatus === "connected" && <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Connected</span>}
                             {backendStatus === "disconnected" && <span className="text-xs bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Offline</span>}
                         </div>
                     </div>
                     <span className="text-xs font-semibold px-2 py-1 bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-200 rounded-md">http://localhost:8000</span>
                </div>
            </CardContent>
        </Card>
    )
}
