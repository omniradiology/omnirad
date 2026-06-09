"use client";

import React, { useState, useEffect, useCallback } from "react";

interface AuditEntry {
    id: string;
    actorName: string;
    actorRole: string;
    actorType: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    patientId: string | null;
    ipAddress: string;
    success: boolean;
    reason: string | null;
    metadata: Record<string, any> | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
    "auth.login.success": "#22c55e",
    "auth.login.failed": "#ef4444",
    "patient.create": "#3b82f6",
    "patient.view": "#8b5cf6",
    "patient.update": "#f59e0b",
    "patient.delete": "#ef4444",
    "patient.export": "#06b6d4",
    "patient.anonymize": "#dc2626",
    "patient.restrict": "#f97316",
    "report.create": "#3b82f6",
    "report.view": "#8b5cf6",
    "report.update": "#f59e0b",
    "report.finalize": "#22c55e",
    "report.delete": "#ef4444",
    "settings.update": "#f59e0b",
    "data.clear": "#dc2626",
    "data.wipe": "#dc2626",
    "user.create": "#3b82f6",
    "user.update": "#f59e0b",
    "user.delete": "#ef4444",
    "compliance.settings.update": "#06b6d4",
    "copilot.message": "#8b5cf6",
    "segmentation.request": "#8b5cf6",
};

export default function AuditLogTable() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: "",
        resourceType: "",
        startDate: "",
        endDate: "",
        success: "" as "" | "true" | "false",
    });

    const fetchLogs = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", "25");
            if (filters.action) params.set("action", filters.action);
            if (filters.resourceType) params.set("resourceType", filters.resourceType);
            if (filters.startDate) params.set("startDate", filters.startDate);
            if (filters.endDate) params.set("endDate", filters.endDate);
            if (filters.success) params.set("success", filters.success);

            const res = await fetch(`/api/compliance/audit?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.data);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch audit logs:", err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString();
        } catch { return iso; }
    };

    const getActionColor = (action: string) => ACTION_COLORS[action] || "#6b7280";

    return (
        <div style={{ width: "100%" }}>
            {/* Filters */}
            <div style={{
                display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap",
                padding: "12px", borderRadius: "8px",
                background: "var(--card-bg, rgba(255,255,255,0.05))",
                border: "1px solid var(--border-color, rgba(255,255,255,0.1))"
            }}>
                <input
                    placeholder="Filter by action..."
                    value={filters.action}
                    onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
                    style={filterInputStyle}
                />
                <select
                    value={filters.resourceType}
                    onChange={(e) => setFilters(f => ({ ...f, resourceType: e.target.value }))}
                    style={filterInputStyle}
                >
                    <option value="">All Resources</option>
                    <option value="patient">Patient</option>
                    <option value="report">Report</option>
                    <option value="auth">Auth</option>
                    <option value="config">Config</option>
                    <option value="ai">AI</option>
                    <option value="fhir">FHIR</option>
                    <option value="user">User</option>
                </select>
                <select
                    value={filters.success}
                    onChange={(e) => setFilters(f => ({ ...f, success: e.target.value as any }))}
                    style={filterInputStyle}
                >
                    <option value="">All Results</option>
                    <option value="true">Success</option>
                    <option value="false">Failed</option>
                </select>
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                    style={filterInputStyle}
                    title="Start date"
                />
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                    style={filterInputStyle}
                    title="End date"
                />
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--border-color, rgba(255,255,255,0.1))" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                        <tr style={{ background: "var(--card-bg, rgba(255,255,255,0.05))" }}>
                            <th style={thStyle}>Timestamp</th>
                            <th style={thStyle}>User</th>
                            <th style={thStyle}>Action</th>
                            <th style={thStyle}>Resource</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", opacity: 0.5 }}>Loading...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", opacity: 0.5 }}>No audit logs found</td></tr>
                        ) : entries.map((entry) => (
                            <tr key={entry.id} style={{
                                borderBottom: "1px solid var(--border-color, rgba(255,255,255,0.06))",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                                <td style={tdStyle}>{formatDate(entry.createdAt)}</td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 500 }}>{entry.actorName}</div>
                                    <div style={{ fontSize: "11px", opacity: 0.6 }}>{entry.actorRole}</div>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{
                                        background: `${getActionColor(entry.action)}20`,
                                        color: getActionColor(entry.action),
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        fontWeight: 500,
                                    }}>
                                        {entry.action}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{ opacity: 0.7 }}>{entry.resourceType}</span>
                                    {entry.resourceId && (
                                        <span style={{ fontSize: "11px", opacity: 0.4, marginLeft: "4px" }}>
                                            {entry.resourceId.substring(0, 8)}...
                                        </span>
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    <span style={{
                                        color: entry.success ? "#22c55e" : "#ef4444",
                                        fontWeight: 500,
                                    }}>
                                        {entry.success ? "✓" : "✗"}
                                    </span>
                                    {entry.reason && (
                                        <span style={{ fontSize: "11px", opacity: 0.5, marginLeft: "4px" }}>
                                            {entry.reason.substring(0, 30)}
                                        </span>
                                    )}
                                </td>
                                <td style={{ ...tdStyle, fontSize: "11px", opacity: 0.5, fontFamily: "monospace" }}>
                                    {entry.ipAddress}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "13px" }}>
                    <span style={{ opacity: 0.6 }}>
                        Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                        <button
                            onClick={() => fetchLogs(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            style={paginationBtnStyle}
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => fetchLogs(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            style={paginationBtnStyle}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    opacity: 0.7,
    borderBottom: "1px solid var(--border-color, rgba(255,255,255,0.1))",
};

const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    verticalAlign: "middle",
};

const filterInputStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
    background: "var(--input-bg, rgba(255,255,255,0.05))",
    color: "inherit",
    fontSize: "13px",
    flex: "1",
    minWidth: "120px",
};

const paginationBtnStyle: React.CSSProperties = {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
    background: "var(--card-bg, rgba(255,255,255,0.05))",
    color: "inherit",
    cursor: "pointer",
    fontSize: "13px",
};
