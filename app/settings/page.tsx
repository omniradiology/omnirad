"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic"
import { Save, Trash2, AlertTriangle, Database, Skull, CheckCircle, X, Server, ArrowLeft, Paintbrush, BrainCircuit, Link2, HardDrive, Users, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { UserManagementPanel } from "@/components/dashboard/UserManagementPanel"
import { AppearancePanel } from "@/components/dashboard/AppearancePanel"
import { AIConfigPanel } from "@/components/dashboard/AIConfigPanel"
import { CopilotConfigPanel } from "@/components/dashboard/CopilotConfigPanel"
import { SegmentationConfigPanel } from "@/components/dashboard/SegmentationConfigPanel"
import { FhirIntegrationPanel } from "@/components/dashboard/FhirIntegrationPanel"
import { SupabaseIntegrationPanel } from "@/components/dashboard/SupabaseIntegrationPanel"
import { SecurityPanel } from "@/components/settings/SecurityPanel"
import { resetSupabaseClient } from "@/lib/supabase"

type SettingsSection = "appearance" | "users" | "security" | "ai" | "integrations" | "storage"

const navItems: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "appearance", label: "Appearance", icon: Paintbrush },
    { id: "users", label: "User Management", icon: Users },
    { id: "security", label: "Security", icon: Shield },
    { id: "ai", label: "AI Configurations", icon: BrainCircuit },
    { id: "integrations", label: "Integrations", icon: Link2 },
    { id: "storage", label: "Storage Management", icon: HardDrive },
]

export default function SettingsPage() {
    const router = useRouter();
    const [activeSection, setActiveSection] = React.useState<SettingsSection>("appearance")
    const [config, setConfig] = React.useState({
        n8nWebhookUrl: "",
        supabaseUrl: "",
        supabaseAnonKey: "",
        pacsOrthancUrl: "",
        pacsAuthType: "none",
        pacsUsername: "",
        pacsPassword: "",
        pacsBearerToken: "",
        pacsAeTitle: "",
    });
    const [isSaved, setIsSaved] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);

    // Modal & toast state
    const [showClearModal, setShowClearModal] = React.useState(false);
    const [showWipeModal, setShowWipeModal] = React.useState(false);
    const [successMessage, setSuccessMessage] = React.useState("");
    const [isProcessing, setIsProcessing] = React.useState(false);

    React.useEffect(() => {
        // Load from SQLite via API
        fetch('/api/settings?type=config')
            .then(res => res.json())
            .then(data => {
                setConfig({
                    n8nWebhookUrl: data.n8nWebhookUrl || "",
                    supabaseUrl: data.supabaseUrl || "",
                    supabaseAnonKey: data.supabaseAnonKey || "",
                    pacsOrthancUrl: data.pacsOrthancUrl || "",
                    pacsAuthType: data.pacsAuthType || "none",
                    pacsUsername: data.pacsUsername || "",
                    pacsPassword: data.pacsPassword || "",
                    pacsBearerToken: data.pacsBearerToken || "",
                    pacsAeTitle: data.pacsAeTitle || "",
                });
            })
            .catch(e => console.error("Error loading config:", e))
            .finally(() => setIsLoading(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setConfig(prev => ({ ...prev, [id]: value }));
        setIsSaved(false);
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { id, value } = e.target;
        setConfig(prev => ({ ...prev, [id]: value }));
        setIsSaved(false);
    };

    const handleSave = async () => {
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'config', data: config }),
        });
        // Reset cached Supabase client so new credentials take effect immediately
        resetSupabaseClient();
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleClearData = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch('/api/reports/clear', { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                setShowClearModal(false);
                setSuccessMessage("All local reports and patients have been cleared successfully!");
                setTimeout(() => setSuccessMessage(""), 4000);
            } else {
                throw new Error(data.error || "Failed");
            }
        } catch (e) {
            console.error(e);
            setShowClearModal(false);
            setSuccessMessage("");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleWipeData = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch('/api/auth/wipe', { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                router.push('/setup');
            } else {
                throw new Error(data.error || "Failed");
            }
        } catch (e) {
            console.error(e);
            setShowWipeModal(false);
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return <div className="p-6 max-w-5xl mx-auto"><p className="text-text-muted">Loading settings...</p></div>;
    }

    return (
        <div className="flex h-full">
            {/* Settings Sidebar */}
            <aside className="w-[260px] min-w-[260px] h-full bg-bg-surface border-r border-border-primary flex flex-col overflow-y-auto shrink-0">
                {/* Back to app */}
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 px-5 py-4 text-sm text-text-muted hover:text-text-primary transition-colors group"
                >
                    <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                    <span>Back to app</span>
                </button>

                {/* Navigation Items */}
                <nav className="flex flex-col px-3 pb-6 gap-0.5">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeSection === item.id
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left w-full
                                    ${isActive
                                        ? 'bg-white/10 text-text-heading shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                    }
                                `}
                            >
                                <Icon size={18} className={isActive ? 'text-primary' : 'text-text-muted'} />
                                <span>{item.label}</span>
                            </button>
                        )
                    })}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-8 space-y-6">
                    {/* Section Header */}
                    <div className="mb-2">
                        <h2 className="text-2xl font-semibold text-text-heading">
                            {navItems.find(n => n.id === activeSection)?.label}
                        </h2>
                    </div>

                    {/* Appearance Section */}
                    {activeSection === "appearance" && (
                        <div className="space-y-6">
                            <AppearancePanel />
                        </div>
                    )}

                    {/* User Management Section */}
                    {activeSection === "users" && (
                        <div className="space-y-6">
                            <UserManagementPanel />
                        </div>
                    )}

                    {/* Security Section */}
                    {activeSection === "security" && (
                        <div className="space-y-6">
                            <SecurityPanel />
                        </div>
                    )}

                    {/* AI Configurations Section */}
                    {activeSection === "ai" && (
                        <div className="space-y-6">
                            <AIConfigPanel />
                            <CopilotConfigPanel />
                            <SegmentationConfigPanel />
                        </div>
                    )}

                    {/* Integrations Section */}
                    {activeSection === "integrations" && (
                        <div className="space-y-6">
                            {/* Supabase Cloud Sync */}
                            <SupabaseIntegrationPanel
                                supabaseUrl={config.supabaseUrl}
                                supabaseAnonKey={config.supabaseAnonKey}
                                onConfigChange={(field, value) => {
                                    setConfig(prev => ({ ...prev, [field]: value }));
                                    setIsSaved(false);
                                }}
                                onSave={handleSave}
                            />

                            {/* PACS / Orthanc Configuration */}
                            <Card className="bg-bg-surface border-border-primary">
                                <CardHeader>
                                    <CardTitle className="text-text-heading flex items-center gap-2">
                                        <Server size={20} className="text-blue-500" />
                                        PACS & Orthanc Configuration
                                    </CardTitle>
                                    <p className="text-sm text-text-secondary">Connect to a DICOMweb-compliant PACS server (e.g. Orthanc).</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="pacsOrthancUrl" className="text-text-primary">DICOMweb Base URL *</Label>
                                        <Input
                                            id="pacsOrthancUrl"
                                            type="url"
                                            placeholder="http://localhost:8042/dicom-web"
                                            value={config.pacsOrthancUrl}
                                            onChange={handleChange}
                                            className="mt-1 bg-bg-panel border-border-primary text-text-primary placeholder-text-muted"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="pacsAuthType" className="text-text-primary">Authentication Type</Label>
                                            <select
                                                id="pacsAuthType"
                                                value={config.pacsAuthType}
                                                onChange={handleSelectChange}
                                                className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                <option value="none">None</option>
                                                <option value="basic">Basic (Username/Password)</option>
                                                <option value="bearer">Bearer Token</option>
                                            </select>
                                        </div>
                                        <div>
                                            <Label htmlFor="pacsAeTitle" className="text-text-primary">Local AE Title (Optional)</Label>
                                            <Input
                                                id="pacsAeTitle"
                                                type="text"
                                                placeholder="OPENRAD"
                                                value={config.pacsAeTitle}
                                                onChange={handleChange}
                                                className="mt-1 bg-bg-panel border-border-primary text-text-primary placeholder-text-muted"
                                            />
                                        </div>
                                    </div>

                                    {config.pacsAuthType === "basic" && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="pacsUsername" className="text-text-primary">Username</Label>
                                                <Input
                                                    id="pacsUsername"
                                                    type="text"
                                                    placeholder="orthanc"
                                                    value={config.pacsUsername}
                                                    onChange={handleChange}
                                                    className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="pacsPassword" className="text-text-primary">Password</Label>
                                                <Input
                                                    id="pacsPassword"
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={config.pacsPassword}
                                                    onChange={handleChange}
                                                    className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {config.pacsAuthType === "bearer" && (
                                        <div>
                                            <Label htmlFor="pacsBearerToken" className="text-text-primary">Bearer Token</Label>
                                            <Input
                                                id="pacsBearerToken"
                                                type="password"
                                                placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                                                value={config.pacsBearerToken}
                                                onChange={handleChange}
                                                className="mt-1 bg-bg-panel border-border-primary text-text-primary"
                                            />
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleSave}
                                        className="w-full mt-4 bg-primary-main hover:bg-primary-hover text-white gap-2"
                                    >
                                        <Save size={16} />
                                        {isSaved ? "Saved!" : "Save PACS Configuration"}
                                    </Button>
                                </CardContent>
                            </Card>

                            <FhirIntegrationPanel />
                        </div>
                    )}

                    {/* Storage Management Section */}
                    {activeSection === "storage" && (
                        <div className="space-y-6">
                            {/* Database Management */}
                            <Card className="bg-bg-surface border-border-primary border-t-4 border-t-red-500">
                                <CardHeader>
                                    <CardTitle className="text-text-heading flex items-center gap-2">
                                        <Database size={20} className="text-red-500" />
                                        Database Management
                                    </CardTitle>
                                    <p className="text-sm text-text-secondary">Manage your report storage and history.</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-500/20 rounded-lg flex gap-3 text-red-800 dark:text-red-400">
                                        <AlertTriangle className="shrink-0 w-5 h-5" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-sm">Clear Local History</p>
                                            <p className="text-xs opacity-90">This will remove all reports AND patients from your Local Database ONLY. Cloud data will remain safe.</p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => setShowClearModal(true)}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        Clear Local Reports & Patients
                                    </Button>

                                    {/* Divider */}
                                    <div className="border-t border-red-200 dark:border-red-900/50 my-2"></div>

                                    {/* Delete Account / Factory Reset */}
                                    <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/40 rounded-lg flex gap-3 text-red-800 dark:text-red-400">
                                        <Skull className="shrink-0 w-5 h-5 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-sm text-red-800 dark:text-red-400">Factory Reset — Delete Everything</p>
                                            <p className="text-xs opacity-80">This will permanently delete ALL users, reports, settings, and data. The app will restart from the initial setup screen. This action is irreversible.</p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => setShowWipeModal(true)}
                                        className="w-full bg-red-900 hover:bg-red-800 text-red-100 font-semibold flex items-center justify-center gap-2 border border-red-700"
                                    >
                                        <Skull size={16} />
                                        Delete Everything & Reset Application
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-green-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
                        <CheckCircle size={20} />
                        <span className="font-medium text-sm">{successMessage}</span>
                        <button onClick={() => setSuccessMessage("")} className="ml-2 hover:opacity-70"><X size={16} /></button>
                    </div>
                </div>
            )}

            {/* Clear Reports Confirmation Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-bg-surface border border-border-primary rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-500/10 rounded-full shrink-0">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-text-heading">Clear Local Report & Patient History?</h3>
                                <p className="text-sm text-text-muted">This will permanently delete <strong>all reports and patients</strong> from your local database. Your Supabase/Cloud data will remain safe.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="outline" className="border-border-card text-text-primary hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white transition-all focus:ring-0" onClick={() => setShowClearModal(false)} disabled={isProcessing}>Cancel</Button>
                            <Button onClick={handleClearData} className="bg-red-600 hover:bg-red-700 text-white" disabled={isProcessing}>
                                {isProcessing ? "Clearing..." : "Yes, Clear Local Data"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Factory Reset Confirmation Modal */}
            {showWipeModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-bg-surface border border-red-500/40 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-500/10 rounded-full shrink-0">
                                <Skull className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-red-400">Factory Reset — Delete Everything?</h3>
                                <p className="text-sm text-text-muted">This will <strong>permanently delete</strong>:</p>
                                <ul className="text-sm text-text-muted list-disc list-inside space-y-1">
                                    <li>All user accounts</li>
                                    <li>All reports & history</li>
                                    <li>All settings & configuration</li>
                                </ul>
                                <p className="text-sm text-red-400 font-medium mt-2">The application will be completely reset. This action is irreversible.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="outline" className="border-border-card text-text-primary hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white transition-all focus:ring-0" onClick={() => setShowWipeModal(false)} disabled={isProcessing}>Cancel</Button>
                            <Button onClick={handleWipeData} className="bg-red-900 hover:bg-red-800 text-red-100 border border-red-700" disabled={isProcessing}>
                                {isProcessing ? "Wiping..." : "Yes, Delete Everything"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
