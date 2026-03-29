"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from "@/components/ui/basic";
import { Trash2, UserPlus } from "lucide-react";

interface DbUser {
    id: string;
    fullName: string;
    username: string;
    email: string;
    role: "Admin" | "User";
    createdAt: string;
}

export function UserManagementPanel() {
    const [users, setUsers] = React.useState<DbUser[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isAdmin, setIsAdmin] = React.useState(false);
    
    // Form state
    const [newUser, setNewUser] = React.useState({
        fullName: "",
        username: "",
        email: "",
        password: "",
        role: "User" as const
    });

    const [error, setError] = React.useState("");

    React.useEffect(() => {
        // First check if current user is admin visually (API will also block them)
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(me => {
                if (me.role === 'Admin') {
                    setIsAdmin(true);
                    loadUsers();
                } else {
                    setIsAdmin(false);
                    setIsLoading(false);
                }
            })
            .catch(() => setIsLoading(false));
    }, []);

    const loadUsers = () => {
        fetch('/api/auth/users')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setUsers(data);
                setIsLoading(false);
            })
            .catch(e => {
                console.error("Error loading users:", e);
                setIsLoading(false);
            });
    };

    const handleAddUser = async () => {
        setError("");
        if (!newUser.fullName || !newUser.username || !newUser.password || !newUser.email) {
            setError("All fields are required.");
            return;
        }

        try {
            const res = await fetch('/api/auth/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            setNewUser({ fullName: "", username: "", email: "", password: "", role: "User" });
            loadUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleRemoveUser = async (id: string, role: string) => {
        if (role === 'Admin') {
            const adminCount = users.filter(u => u.role === 'Admin').length;
            if (adminCount <= 1) {
                alert("Cannot delete the last Admin account.");
                return;
            }
        }

        if (confirm("Are you sure you want to completely remove this user account?")) {
            try {
                const res = await fetch(`/api/auth/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (res.ok) {
                    loadUsers();
                } else {
                    const data = await res.json();
                    alert(data.error || "Failed to remove user");
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    const toggleRole = async (user: DbUser) => {
        const newRole = user.role === 'Admin' ? 'User' : 'Admin';

        if (user.role === 'Admin') {
            const adminCount = users.filter(u => u.role === 'Admin').length;
            if (adminCount <= 1) {
                alert("Cannot demote the last Admin account.");
                return;
            }
        }

        try {
            const res = await fetch('/api/auth/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, role: newRole }),
            });
            if (res.ok) {
                loadUsers();
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (isLoading) return null;
    if (!isAdmin) return null; // Hide panel entirely if not admin

    return (
        <Card className="bg-bg-surface border-border-primary">
            <CardHeader>
                <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Add User Form */}
                <div className="bg-bg-panel/30 p-6 rounded-xl border border-border-primary space-y-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border-primary/50 pb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-text-heading">Create New User</h3>
                            <p className="text-sm text-text-muted mt-1">Add a new team member to OpenRad and assign their permissions.</p>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-full hidden sm:block">
                            <UserPlus size={24} className="text-primary" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="space-y-2">
                            <Label className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Full Name</Label>
                            <Input
                                value={newUser.fullName}
                                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                                placeholder="Jane Doe"
                                className="h-10 bg-bg-surface"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Username</Label>
                            <Input
                                value={newUser.username}
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                                placeholder="janed"
                                className="h-10 bg-bg-surface font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Email Address</Label>
                            <Input
                                type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                placeholder="jane@example.com"
                                className="h-10 bg-bg-surface"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Temporary Password</Label>
                            <Input
                                type="text"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                placeholder="Secure temporary password"
                                className="h-10 bg-bg-surface"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Role Access</Label>
                            <select
                                className="flex h-10 w-full md:w-1/2 rounded-md border border-border-primary bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                            >
                                <option value="User">User</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border-primary/50 gap-4 mt-2">
                        <div className="text-red-500 text-sm font-medium">{error}</div>
                        <Button onClick={handleAddUser} className="bg-primary hover:bg-primary-hover text-white h-10 px-8 w-full sm:w-auto shadow-md">
                            <UserPlus size={16} className="mr-2" /> Create User
                        </Button>
                    </div>
                </div>

                {/* Users List */}
                <div className="rounded-md border border-border-primary overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-bg-panel text-text-secondary border-b border-border-primary">
                            <tr>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Username</th>
                                <th className="px-4 py-3 font-medium">Role</th>
                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-primary">
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-text-muted">No users found.</td>
                                </tr>
                            )}
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-bg-panel/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-text-heading">{user.fullName}</div>
                                        <div className="text-xs text-text-muted">{user.email}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-text-primary font-mono text-xs">@{user.username}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button 
                                            onClick={() => toggleRole(user)}
                                            className="focus:outline-none hover:opacity-80 transition-opacity"
                                            title="Click to toggle role"
                                        >
                                            <Badge variant="outline" className={`text-text-primary border-border-primary ${user.role === 'Admin' ? 'bg-primary/20 text-primary-hover border-primary/30' : ''}`}>
                                                {user.role}
                                            </Badge>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-400 hover:bg-red-950/20"
                                            onClick={() => handleRemoveUser(user.id, user.role)}
                                            title="Revoke Access / Delete"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
