"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic"
import { Save, Cpu, CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react"

export function SegmentationConfigPanel() {
    const [loading, setLoading] = React.useState(true)
    const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle")
    const [errorMsg, setErrorMsg] = React.useState("")
    const [isLocked, setIsLocked] = React.useState(false)

    // Connection state
    const [connStatus, setConnStatus] = React.useState<"idle" | "checking" | "verified" | "invalid">("idle")
    const [connError, setConnError] = React.useState("")
    const [showApiKey, setShowApiKey] = React.useState(false)
    const [showDropdown, setShowDropdown] = React.useState(false)
    const [availableModels, setAvailableModels] = React.useState<string[]>([])

    const [formData, setFormData] = React.useState({
        deploymentMode: "localhost" as "localhost" | "custom_api",
        modelType: "medsam3" as "medsam2" | "medsam3",
        providerName: "MedSAM3",
        modelName: "",
        baseUrl: "http://localhost:5000",
        healthEndpoint: "/healthz",
        predictEndpoint: "/v1/segmentations",
        apiSecretKey: "",
        timeoutSeconds: 120,
        supportsContours: true,
        supports3D: false,
        returnsMask: true,
        returnsBox: true,
        isActive: false,
    })

    React.useEffect(() => {
        fetch("/api/segmentation-config")
            .then(res => res.json())
            .then(data => {
                if (!data.error) {
                    setFormData({
                        deploymentMode: data.deploymentMode || "localhost",
                        modelType: data.modelType || "medsam3",
                        providerName: data.providerName || "MedSAM3",
                        modelName: data.modelName || "medsam3",
                        baseUrl: data.baseUrl || "http://localhost:5000",
                        healthEndpoint: data.healthEndpoint || "/health",
                        predictEndpoint: data.predictEndpoint || "/predict",
                        apiSecretKey: data.apiSecretKey || "",
                        timeoutSeconds: data.timeoutSeconds || 120,
                        supportsContours: data.supportsContours ?? true,
                        supports3D: data.supports3D ?? false,
                        returnsMask: data.returnsMask ?? true,
                        returnsBox: data.returnsBox ?? true,
                        isActive: data.isActive ?? false,
                    })
                    if (data.isActive) {
                        setIsLocked(true)
                        setConnStatus("verified")
                    }
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target as HTMLInputElement
        const fieldName = id.replace("seg_", "")

        if (type === "checkbox") {
            setFormData(prev => ({ ...prev, [fieldName]: (e.target as HTMLInputElement).checked }))
        } else if (type === "number") {
            setFormData(prev => ({ ...prev, [fieldName]: parseInt(value) || 0 }))
        } else {
            setFormData(prev => ({ ...prev, [fieldName]: value }))
        }

        if (fieldName === "modelType") {
            setConnStatus("idle")
            if (value === "medsam2") {
                setFormData(prev => ({
                    ...prev,
                    modelType: "medsam2" as const,
                    providerName: "MedSAM2",
                    modelName: "",
                }))
            } else {
                setFormData(prev => ({
                    ...prev,
                    modelType: "medsam3" as const,
                    providerName: "MedSAM3",
                    modelName: "",
                }))
            }
        }

        if (fieldName === "deploymentMode") {
            setConnStatus("idle")
            if (value === "localhost") {
                setFormData(prev => ({
                    ...prev,
                    deploymentMode: "localhost" as const,
                    baseUrl: "http://localhost:5000",
                    apiSecretKey: "",
                }))
            } else {
                setFormData(prev => ({
                    ...prev,
                    deploymentMode: "custom_api" as const,
                    baseUrl: "",
                }))
            }
        }

        setSaveStatus("idle")
    }

    const testConnection = async () => {
        setConnStatus("checking")
        setConnError("")
        try {
            const res = await fetch("/api/segmentation-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseUrl: formData.baseUrl,
                    healthEndpoint: formData.healthEndpoint,
                    apiSecretKey: formData.apiSecretKey,
                    timeoutSeconds: 15,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setConnStatus("verified")
                
                // Read available models fetched securely via Next.js backend
                if (data.availableModels && data.availableModels.length > 0) {
                    setAvailableModels(data.availableModels)
                    
                    // If current modelName isn't in fetched list, auto-select the first one
                    if (!data.availableModels.includes(formData.modelName)) {
                        setFormData(prev => ({ ...prev, modelName: data.availableModels[0] }))
                    }
                }
            } else {
                setConnStatus("invalid")
                setConnError(data.error || "Connection failed.")
            }
        } catch {
            setConnStatus("invalid")
            setConnError("Could not reach the segmentation backend.")
        }
    }

    const handleSave = async () => {
        if (!formData.baseUrl) { setErrorMsg("Base URL is required."); setSaveStatus("error"); return }
        if (!formData.predictEndpoint) { setErrorMsg("Predict Endpoint is required."); setSaveStatus("error"); return }

        setSaveStatus("saving")
        setErrorMsg("")
        try {
            const res = await fetch("/api/segmentation-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, isActive: true }),
            })
            const result = await res.json()
            if (res.ok && result.success) {
                setSaveStatus("saved")
                setIsLocked(true)
                setFormData(prev => ({ ...prev, isActive: true }))
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
        <Card className="bg-bg-surface border-border-primary border-t-4 border-t-violet-500">
            <CardHeader>
                <CardTitle className="text-text-heading flex items-center gap-2">
                    <Cpu size={20} className="text-violet-500" />
                    Segmentation Model Integration
                </CardTitle>
                <p className="text-sm text-text-secondary">
                    Configure a MedSAM2 or MedSAM3 segmentation backend for AI-powered annotations in the Copilot workspace.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* Model Type Selector */}
                <div>
                    <Label htmlFor="seg_modelType" className="text-text-primary">Model Type</Label>
                    <select
                        id="seg_modelType"
                        value={formData.modelType}
                        onChange={handleChange}
                        disabled={isLocked}
                        className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel disabled:opacity-50 px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                        <option value="medsam3">MedSAM3 — Text-Guided Segmentation</option>
                        <option value="medsam2">MedSAM2 — Box/Point-Guided Segmentation</option>
                    </select>
                    {formData.modelType === "medsam2" ? (
                        <p className="mt-1.5 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>
                            Spatial prompts — uses bounding box or point coordinates. Best for precise, localization-guided segmentation.
                        </p>
                    ) : (
                        <p className="mt-1.5 text-xs text-sky-400/80 bg-sky-500/10 border border-sky-500/20 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Text prompts — uses natural language like &quot;brain lesion&quot;. Best for concept-driven segmentation.
                        </p>
                    )}
                </div>
                {/* Deployment Mode */}
                <div>
                    <Label htmlFor="seg_deploymentMode" className="text-text-primary">Deployment Mode</Label>
                    <select
                        id="seg_deploymentMode"
                        value={formData.deploymentMode}
                        onChange={handleChange}
                        disabled={isLocked}
                        className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel disabled:opacity-50 px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                        <option value="localhost">Localhost</option>
                        <option value="custom_api">Custom API (Remote)</option>
                    </select>
                </div>

                {/* Base URL */}
                <div>
                    <Label htmlFor="seg_baseUrl" className="text-text-primary">Base URL *</Label>
                    <Input
                        id="seg_baseUrl"
                        value={formData.baseUrl}
                        onChange={handleChange}
                        disabled={isLocked}
                        placeholder={formData.deploymentMode === "localhost" ? "http://localhost:5000" : `https://your-${formData.modelType}-api.com`}
                        className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50"
                    />
                </div>

                {/* API Key (custom_api only) */}
                {formData.deploymentMode === "custom_api" && (
                    <div>
                        <Label htmlFor="seg_apiSecretKey" className="text-text-primary">API Secret Key</Label>
                        <div className="relative mt-1">
                            <Input
                                id="seg_apiSecretKey"
                                type={showApiKey ? "text" : "password"}
                                value={formData.apiSecretKey}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="Enter API key (if required)"
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

                {/* Advanced Connection Settings */}
                <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-2">
                        <span className="group-open:rotate-90 transition-transform">▸</span>
                        Advanced Connection Settings
                    </summary>
                    <div className="mt-4 pl-4 border-l-2 border-violet-500/20 grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="seg_healthEndpoint" className="text-text-primary">Health Endpoint</Label>
                            <Input
                                id="seg_healthEndpoint"
                                value={formData.healthEndpoint}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="/health"
                                className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="seg_predictEndpoint" className="text-text-primary">Predict Endpoint</Label>
                            <Input
                                id="seg_predictEndpoint"
                                value={formData.predictEndpoint}
                                onChange={handleChange}
                                disabled={isLocked}
                                placeholder="/predict"
                                className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="seg_timeoutSeconds" className="text-text-primary">Timeout (sec)</Label>
                            <Input
                                id="seg_timeoutSeconds"
                                type="number"
                                value={formData.timeoutSeconds.toString()}
                                onChange={handleChange}
                                disabled={isLocked}
                                className="mt-1 bg-bg-panel border-border-primary text-text-primary disabled:opacity-50 w-full"
                            />
                        </div>
                    </div>
                </details>

                {/* Test Connection Button */}
                <Button
                    variant="outline"
                    onClick={testConnection}
                    disabled={connStatus === "checking" || isLocked || !formData.baseUrl}
                    className="w-full border-violet-500 text-violet-500 hover:bg-violet-50 gap-2 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={connStatus === "checking" ? "animate-spin" : ""} />
                    {connStatus === "checking" ? "Testing Connection..." : "Test Connection"}
                </Button>

                {connStatus === "invalid" && (
                    <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                        <strong>Connection Failed:</strong> {connError}
                    </div>
                )}
                {connStatus === "verified" && (
                    <div className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded-md border border-green-500/20 flex items-center gap-1.5">
                        <CheckCircle size={14} /> <strong>Connection Verified:</strong> Segmentation backend is reachable.
                    </div>
                )}

                <div className="pt-2 border-t border-border-primary"></div>

                {/* Model Name (Provider silently tracked) */}
                <div className="relative">
                    <Label htmlFor="seg_modelName" className="text-text-primary">Model Name</Label>
                    <div className="relative mt-1">
                        <Input
                            id="seg_modelName"
                            value={connStatus === "verified" ? formData.modelName : ""}
                            onChange={(e) => {
                                handleChange(e)
                                setShowDropdown(true)
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                            disabled={connStatus !== "verified" || isLocked}
                            placeholder="Models"
                            className="bg-bg-panel border-border-primary text-text-primary pr-10 disabled:opacity-50 w-full"
                            autoComplete="off"
                        />
                        {connStatus === "verified" && !isLocked && (
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    setShowDropdown(!showDropdown)
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                            >
                                {showDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                    </div>
                    {/* Dropdown Menu */}
                    {showDropdown && connStatus === "verified" && availableModels.length > 0 && (
                        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border-primary bg-bg-panel py-1 text-sm shadow-xl hide-scrollbar">
                            {(availableModels.includes(formData.modelName)
                                ? availableModels
                                : availableModels.filter(m => m.toLowerCase().includes(formData.modelName.toLowerCase()))
                            ).map(name => (
                                <li
                                    key={name}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        setFormData(prev => ({ ...prev, modelName: name, providerName: formData.modelType === "medsam2" ? "MedSAM2" : "MedSAM3" }))
                                        setShowDropdown(false)
                                    }}
                                    className="cursor-pointer px-3 py-2 text-text-primary hover:bg-slate-200 dark:hover:bg-violet-600/40"
                                >
                                    {name}
                                </li>
                            ))}
                            {!availableModels.includes(formData.modelName) && availableModels.filter(m => m.toLowerCase().includes(formData.modelName.toLowerCase())).length === 0 && (
                                <li className="px-3 py-2 text-text-muted cursor-pointer" onMouseDown={(e) => {
                                    e.preventDefault()
                                    setShowDropdown(false)
                                }}>
                                    Use custom model: '{formData.modelName}'
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                {/* Capability Toggles */}
                <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-2">
                        <span className="group-open:rotate-90 transition-transform">▸</span>
                        Model Capabilities
                    </summary>
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-violet-500/20">
                        <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer w-fit">
                            <input
                                type="checkbox"
                                id="seg_returnsMask"
                                checked={formData.returnsMask}
                                onChange={handleChange}
                                disabled={connStatus !== "verified" || isLocked}
                                className="rounded border-border-primary accent-violet-500"
                            />
                            Returns Mask
                        </label>
                        <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer w-fit">
                            <input
                                type="checkbox"
                                id="seg_returnsBox"
                                checked={formData.returnsBox}
                                onChange={handleChange}
                                disabled={connStatus !== "verified" || isLocked}
                                className="rounded border-border-primary accent-violet-500"
                            />
                            Returns Bounding Box
                        </label>
                        <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer w-fit">
                            <input
                                type="checkbox"
                                id="seg_supportsContours"
                                checked={formData.supportsContours}
                                onChange={handleChange}
                                disabled={connStatus !== "verified" || isLocked}
                                className="rounded border-border-primary accent-violet-500"
                            />
                            Supports Contour Extraction
                        </label>
                        <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer w-fit">
                            <input
                                type="checkbox"
                                id="seg_supports3D"
                                checked={formData.supports3D}
                                onChange={handleChange}
                                disabled={connStatus !== "verified" || isLocked}
                                className="rounded border-border-primary accent-violet-500"
                            />
                            Supports 3D Volumes
                        </label>
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
                        <CheckCircle size={16} /> Configuration saved and activated!
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
                        className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white gap-2 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saveStatus === "saving" ? "Saving..." : "Save & Activate Segmentation"}
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
