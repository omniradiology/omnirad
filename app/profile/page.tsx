"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/components/ui/basic";
import { Save, User, KeyRound, LogOut, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
    const router = useRouter();
    
    // Account details
    const [account, setAccount] = React.useState({ fullName: "", username: "", email: "", role: "", position: "" });
    const [accountSaved, setAccountSaved] = React.useState(false);
    const [accountError, setAccountError] = React.useState("");
    const [isAccountLoading, setIsAccountLoading] = React.useState(true);

    // Password details
    const [passwords, setPasswords] = React.useState({ current: "", new: "", confirm: "" });
    const [showPasswords, setShowPasswords] = React.useState({ current: false, new: false, confirm: false });
    const [passSaved, setPassSaved] = React.useState(false);
    const [passError, setPassError] = React.useState("");

    React.useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(meData => {
                if (meData.id) {
                    setAccount({ fullName: meData.fullName, username: meData.username, email: meData.email, role: meData.role, position: meData.position || "" });
                }
                setIsAccountLoading(false);
            })
            .catch(() => setIsAccountLoading(false));
    }, []);

    const handleAccountSave = async () => {
        setAccountError("");
        const res = await fetch('/api/auth/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(account),
        });
        const data = await res.json();
        if (!res.ok) {
            setAccountError(data.error);
        } else {
            setAccountSaved(true);
            setTimeout(() => setAccountSaved(false), 2000);
        }
    };

    const handlePasswordSave = async () => {
        setPassError("");
        if (passwords.new !== passwords.confirm) {
            setPassError("New passwords do not match.");
            return;
        }
        const res = await fetch('/api/auth/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new }),
        });
        const data = await res.json();
        if (!res.ok) {
            setPassError(data.error);
        } else {
            setPassSaved(true);
            setPasswords({ current: "", new: "", confirm: "" });
            setTimeout(() => setPassSaved(false), 2000);
        }
    };


    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    if (isAccountLoading) {
        return <div className="p-6 max-w-5xl mx-auto"><p className="text-text-muted">Loading profile...</p></div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                 <div className="space-y-1">
                    <h2 className="text-2xl font-semibold text-text-heading">Your Profile</h2>
                    <p className="text-text-secondary text-sm">Manage your personal details and security.</p>
                </div>
                <Button onClick={handleLogout} variant="danger" className="flex gap-2">
                    <LogOut size={16} /> Logout
                </Button>
            </div>

            <Card className="bg-bg-surface border-border-primary">
                <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6 pb-6 border-b border-border-primary">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User size={40} />
                        </div>
                        <div>
                            <h3 className="font-medium text-lg">{account.fullName || "Your Name"}</h3>
                            <div className="flex gap-2 items-center mt-1">
                                <span className="text-xs bg-bg-secondary text-text-secondary px-2 py-1 rounded inline-block uppercase tracking-widest">{account.role}</span>
                                {account.position && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded inline-block uppercase tracking-widest">{account.position}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input value={account.fullName} onChange={(e) => setAccount({ ...account, fullName: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Username</Label>
                                <Input value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={account.email} type="email" onChange={(e) => setAccount({ ...account, email: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Professional Position</Label>
                                <select 
                                    className="flex h-10 w-full rounded-md border border-border-primary bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                    value={account.position || ""} 
                                    onChange={(e) => setAccount({ ...account, position: e.target.value })}
                                >
                                    <option value="" disabled>Select position...</option>
                                    <option value="Radiologist">Radiologist</option>
                                    <option value="Doctor">Doctor / Physician</option>
                                    <option value="Technician">Radiology Technician</option>
                                    <option value="Nurse">Nurse</option>
                                    <option value="Administrator">Administrator</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {accountError && <p className="text-red-500 text-sm mt-2">{accountError}</p>}

                    <div className="pt-4 flex items-center gap-4 border-t border-border-primary mt-4">
                        <Button onClick={handleAccountSave} className="gap-2">
                            <Save size={16} /> Update Details
                        </Button>
                        {accountSaved && <span className="text-sm text-green-600 font-medium">Updated successfully!</span>}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-bg-surface border-border-primary">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><KeyRound size={20}/> Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Current Password</Label>
                        <div className="relative">
                            <Input type={showPasswords.current ? "text" : "password"} value={passwords.current} onChange={(e) => setPasswords({...passwords, current: e.target.value})} className="pr-10" />
                            <button type="button" onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none">
                                {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>New Password</Label>
                            <div className="relative">
                                <Input type={showPasswords.new ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} className="pr-10" />
                                <button type="button" onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none">
                                    {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Confirm New Password</Label>
                            <div className="relative">
                                <Input type={showPasswords.confirm ? "text" : "password"} value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} className="pr-10" />
                                <button type="button" onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none">
                                    {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {passError && <p className="text-red-500 text-sm">{passError}</p>}

                    <div className="pt-4 flex items-center gap-4">
                        <Button onClick={handlePasswordSave} variant="outline" className="gap-2">
                            Update Password
                        </Button>
                        {passSaved && <span className="text-sm text-green-600 font-medium">Password saved!</span>}
                    </div>
                </CardContent>
            </Card>


        </div>
    );
}
