"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic"
import { Save, Trash2, AlertTriangle, Database, Skull, CheckCircle, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { UserManagementPanel } from "@/components/dashboard/UserManagementPanel"
import { AppearancePanel } from "@/components/dashboard/AppearancePanel"

export default function SettingsPage() {
    const router = useRouter();
    const [config, setConfig] = React.useState({
        n8nWebhookUrl: "",
        supabaseUrl: "",
        supabaseAnonKey: ""
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

    const handleSave = async () => {
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'config', data: config }),
        });
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
                setSuccessMessage("All local reports have been cleared successfully!");
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
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-text-heading">Settings</h2>
                <p className="text-text-secondary text-sm">Configure API connections and integrations.</p>
            </div>

            {/* Appearance Settings */}
            <AppearancePanel />

            {/* API Configuration */}
            <Card className="bg-bg-surface border-border-primary">
                <CardHeader>
                    <CardTitle className="text-text-heading">API Configuration</CardTitle>
                    <p className="text-sm text-text-secondary">Configure n8n webhook and Supabase connection</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="n8nWebhookUrl" className="text-text-primary">n8n Webhook URL</Label>
                        <Input
                            id="n8nWebhookUrl"
                            type="url"
                            placeholder="https://your-n8n-instance.com/webhook/..."
                            value={config.n8nWebhookUrl}
                            onChange={handleChange}
                            className="mt-1 bg-bg-panel border-border-primary text-text-primary placeholder-text-muted"
                        />
                    </div>

                    <div>
                        <Label htmlFor="supabaseUrl" className="text-text-primary">Supabase URL</Label>
                        <Input
                            id="supabaseUrl"
                            type="url"
                            placeholder="https://your-project.supabase.co"
                            value={config.supabaseUrl}
                            onChange={handleChange}
                            className="mt-1 bg-bg-panel border-border-primary text-text-primary placeholder-text-muted"
                        />
                    </div>

                    <div>
                        <Label htmlFor="supabaseAnonKey" className="text-text-primary">Supabase Anon Key</Label>
                        <Input
                            id="supabaseAnonKey"
                            type="password"
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            value={config.supabaseAnonKey}
                            onChange={handleChange}
                            className="mt-1 bg-bg-panel border-border-primary text-text-primary placeholder-text-muted"
                        />
                    </div>

                    <Button
                        onClick={handleSave}
                        className="w-full mt-4 bg-primary-main hover:bg-primary-hover text-white gap-2"
                    >
                        <Save size={16} />
                        {isSaved ? "Saved!" : "Save Configuration"}
                    </Button>
                </CardContent>
            </Card>

            {/* User Management */}
            <UserManagementPanel />

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
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex gap-3 text-red-800">
                        <AlertTriangle className="shrink-0 w-5 h-5" />
                        <div className="space-y-1">
                            <p className="font-semibold text-sm">Clear Local History</p>
                            <p className="text-xs opacity-90">This will remove all reports from your Local Database ONLY. Cloud data will remain safe.</p>
                        </div>
                    </div>

                    <Button
                        onClick={() => setShowClearModal(true)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} />
                        Clear Local Report History
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
                                <h3 className="text-lg font-semibold text-text-heading">Clear Local Report History?</h3>
                                <p className="text-sm text-text-muted">This will permanently delete <strong>all reports</strong> from your local database. Your Supabase/Cloud data will remain safe.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="outline" className="border-border-card text-text-primary hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white transition-all focus:ring-0" onClick={() => setShowClearModal(false)} disabled={isProcessing}>Cancel</Button>
                            <Button onClick={handleClearData} className="bg-red-600 hover:bg-red-700 text-white" disabled={isProcessing}>
                                {isProcessing ? "Clearing..." : "Yes, Clear All Reports"}
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
