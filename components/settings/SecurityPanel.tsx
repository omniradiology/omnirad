"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui/basic"
import { Shield, ShieldCheck, ShieldOff, Lock, Unlock, AlertTriangle, Clock, User } from "lucide-react"

interface SecuritySettings {
    appLockEnabled: boolean
    defaultUserId: string | null
    updatedBy: string | null
    updatedAt: string | null
    updatedByName: string | null
}

interface CurrentUser {
    id: string
    fullName: string
    username?: string
    role: string
}

export function SecurityPanel() {
    const [settings, setSettings] = React.useState<SecuritySettings>({
        appLockEnabled: true,
        defaultUserId: null,
        updatedBy: null,
        updatedAt: null,
        updatedByName: null,
    })
    const [usersList, setUsersList] = React.useState<CurrentUser[]>([])
    const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [isSaving, setIsSaving] = React.useState(false)
    const [showConfirmModal, setShowConfirmModal] = React.useState(false)
    const [pendingLockState, setPendingLockState] = React.useState<boolean>(true)
    const [saveSuccess, setSaveSuccess] = React.useState(false)

    // Load current user and security settings
    React.useEffect(() => {
        Promise.all([
            fetch('/api/auth/me').then(r => r.json()),
            fetch('/api/settings?type=security').then(r => r.json()),
            fetch('/api/auth/users').then(r => r.json()),
        ])
            .then(([userData, secData, usersData]) => {
                if (userData && !userData.error) {
                    setCurrentUser(userData)
                }
                setSettings({
                    appLockEnabled: secData.appLockEnabled ?? true,
                    defaultUserId: secData.defaultUserId || null,
                    updatedBy: secData.updatedBy || null,
                    updatedAt: secData.updatedAt || null,
                    updatedByName: secData.updatedByName || null,
                })
                if (usersData && Array.isArray(usersData)) {
                    setUsersList(usersData)
                }
            })
            .catch(e => console.error("Error loading security settings:", e))
            .finally(() => setIsLoading(false))
    }, [])

    const isAdmin = currentUser?.role === "Admin"

    const handleToggleClick = (newState: boolean) => {
        setPendingLockState(newState)
        setShowConfirmModal(true)
    }

    const handleConfirm = async () => {
        setShowConfirmModal(false)
        setIsSaving(true)
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'security',
                    data: { appLockEnabled: pendingLockState, defaultUserId: settings.defaultUserId },
                }),
            })
            if (res.ok) {
                setSettings(prev => ({
                    ...prev,
                    appLockEnabled: pendingLockState,
                    updatedByName: currentUser?.fullName || null,
                    updatedAt: new Date().toISOString(),
                }))
                setSaveSuccess(true)
                setTimeout(() => setSaveSuccess(false), 3000)
            } else {
                const data = await res.json()
                console.error("Failed to save:", data.error)
            }
        } catch (e) {
            console.error("Error saving security settings:", e)
        } finally {
            setIsSaving(false)
        }
    }

    const handleUserChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newUserId = e.target.value
        setSettings(prev => ({ ...prev, defaultUserId: newUserId }))
        setIsSaving(true)
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'security',
                    data: { appLockEnabled: settings.appLockEnabled, defaultUserId: newUserId },
                }),
            })
            if (res.ok) {
                setSettings(prev => ({
                    ...prev,
                    updatedByName: currentUser?.fullName || null,
                    updatedAt: new Date().toISOString(),
                }))
                setSaveSuccess(true)
                setTimeout(() => setSaveSuccess(false), 3000)
            } else {
                console.error("Failed to save default user")
            }
        } catch (e) {
            console.error("Error saving security settings:", e)
        } finally {
            setIsSaving(false)
        }
    }

    const formatDate = (iso: string | null) => {
        if (!iso) return null
        try {
            return new Date(iso).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
        } catch {
            return iso
        }
    }

    if (isLoading) {
        return (
            <Card className="bg-bg-surface border-border-primary">
                <CardContent className="py-12 text-center">
                    <div className="inline-flex items-center gap-2 text-text-muted">
                        <div className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                        Loading security settings...
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Non-admin users see a restricted message
    if (!isAdmin) {
        return (
            <Card className="bg-bg-surface border-border-primary">
                <CardHeader>
                    <CardTitle className="text-text-heading flex items-center gap-2">
                        <Shield size={20} className="text-amber-500" />
                        Security
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <Lock size={20} className="text-amber-500 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-text-primary">Admin Access Required</p>
                            <p className="text-xs text-text-muted mt-0.5">Only administrators can view and change security settings.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            {/* Main Security Card */}
            <Card className="bg-bg-surface border-border-primary overflow-hidden">
                <CardHeader className="pb-4">
                    <CardTitle className="text-text-heading flex items-center gap-2">
                        <Shield size={20} className="text-blue-500" />
                        App Lock Mode
                    </CardTitle>
                    <p className="text-sm text-text-secondary">
                        Control whether users need to log in when opening the application.
                    </p>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Current Status */}
                    <div className={`
                        flex items-center justify-between p-4 rounded-xl border transition-all duration-500
                        ${settings.appLockEnabled
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-amber-500/5 border-amber-500/20'
                        }
                    `}>
                        <div className="flex items-center gap-3">
                            <div className={`
                                p-2.5 rounded-xl transition-all duration-500
                                ${settings.appLockEnabled
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : 'bg-amber-500/15 text-amber-500'
                                }
                            `}>
                                {settings.appLockEnabled
                                    ? <ShieldCheck size={22} />
                                    : <ShieldOff size={22} />
                                }
                            </div>
                            <div>
                                <p className={`text-sm font-semibold ${settings.appLockEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {settings.appLockEnabled ? "App is Locked" : "App is Unlocked"}
                                </p>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {settings.appLockEnabled
                                        ? "Login with username & password is required to access the app."
                                        : "The app opens directly without login — auto-logged in as admin."
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Toggle Button */}
                        <button
                            onClick={() => handleToggleClick(!settings.appLockEnabled)}
                            disabled={isSaving}
                            className={`
                                relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface
                                disabled:cursor-not-allowed disabled:opacity-50
                                ${settings.appLockEnabled
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'bg-zinc-600 border-zinc-600'
                                }
                            `}
                            role="switch"
                            aria-checked={settings.appLockEnabled}
                            aria-label="Toggle app lock"
                        >
                            <span className={`
                                pointer-events-none flex items-center justify-center h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300
                                ${settings.appLockEnabled ? 'translate-x-[26px]' : 'translate-x-[3px]'}
                            `}>
                                {settings.appLockEnabled
                                    ? <Lock size={11} className="text-emerald-600" />
                                    : <Unlock size={11} className="text-zinc-500" />
                                }
                            </span>
                        </button>
                    </div>

                    {/* Unlocked Warning */}
                    {!settings.appLockEnabled && (
                        <div className="flex gap-3 p-3.5 bg-amber-500/8 border border-amber-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-400">Security Notice</p>
                                <p className="text-xs text-text-muted mt-1">
                                    Anyone with physical access to this workstation can use the application without credentials. 
                                    Only use this mode on trusted, single-user workstations.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Auto-login User Selection */}
                    {!settings.appLockEnabled && (
                        <div className="flex flex-col gap-2 p-4 bg-bg-panel border border-border-primary rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                            <label htmlFor="defaultUserId" className="text-sm font-medium text-text-primary">
                                Auto-Login User
                            </label>
                            <p className="text-xs text-text-muted mb-2">
                                Select which user account the application will automatically log into when opened.
                            </p>
                            <select
                                id="defaultUserId"
                                value={settings.defaultUserId || ""}
                                onChange={handleUserChange}
                                disabled={isSaving}
                                className="flex h-10 w-full rounded-md border border-border-primary bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                            >
                                <option value="" disabled>Select a user</option>
                                {usersList.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.fullName} (@{user.username || 'user'}) - {user.role}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Last Changed Info */}
                    {settings.updatedAt && (
                        <div className="flex items-center gap-4 pt-2 border-t border-border-primary">
                            <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                <User size={12} />
                                <span>Changed by <span className="text-text-secondary font-medium">{settings.updatedByName || 'Unknown'}</span></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                <Clock size={12} />
                                <span>{formatDate(settings.updatedAt)}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* How It Works Card */}
            <Card className="bg-bg-surface border-border-primary">
                <CardHeader className="pb-3">
                    <CardTitle className="text-text-heading text-base flex items-center gap-2">
                        How It Works
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex gap-3 p-3 rounded-lg bg-white/[0.02]">
                            <div className="p-2 rounded-lg bg-emerald-500/10 h-fit">
                                <Lock size={16} className="text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-text-primary">Locked Mode</p>
                                <p className="text-xs text-text-muted mt-1">
                                    Users must enter their username and password each time they open the app. Best for shared workstations.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 p-3 rounded-lg bg-white/[0.02]">
                            <div className="p-2 rounded-lg bg-amber-500/10 h-fit">
                                <Unlock size={16} className="text-amber-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-text-primary">Unlocked Mode</p>
                                <p className="text-xs text-text-muted mt-1">
                                    The app opens directly as the admin user — no login screen. Best for personal, single-user workstations.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save Success Toast */}
            {saveSuccess && (
                <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
                        <ShieldCheck size={20} />
                        <span className="font-medium text-sm">
                            {settings.appLockEnabled ? "App locked — login required" : "App unlocked — direct access enabled"}
                        </span>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-bg-surface border border-border-primary rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full shrink-0 ${pendingLockState ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                                {pendingLockState
                                    ? <Lock className="w-6 h-6 text-emerald-500" />
                                    : <Unlock className="w-6 h-6 text-amber-500" />
                                }
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-text-heading">
                                    {pendingLockState ? "Lock the Application?" : "Unlock the Application?"}
                                </h3>
                                <p className="text-sm text-text-muted">
                                    {pendingLockState
                                        ? "All users will need to enter their username and password to access the application."
                                        : "The application will open directly without a login screen. Anyone with access to this workstation can use the app."
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <Button
                                variant="outline"
                                className="border-border-card text-text-primary hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white transition-all focus:ring-0"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                className={`text-white ${pendingLockState
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                                disabled={isSaving}
                            >
                                {isSaving
                                    ? "Saving..."
                                    : pendingLockState
                                        ? "Yes, Lock App"
                                        : "Yes, Unlock App"
                                }
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
