"use client";

import React, { useState, useEffect } from "react";

interface ComplianceConfig {
    dataRetentionDays: number;
    auditRetentionDays: number;
    sessionTimeoutMinutes: number;
    idleTimeoutMinutes: number;
    enableGdprExport: boolean;
    enableGdprAnonymize: boolean;
    enableGdprRestriction: boolean;
    legalBasis: string;
    privacyPolicyUrl: string;
    dpoContactEmail: string;
}

const defaults: ComplianceConfig = {
    dataRetentionDays: 2555,
    auditRetentionDays: 2555,
    sessionTimeoutMinutes: 15,
    idleTimeoutMinutes: 30,
    enableGdprExport: true,
    enableGdprAnonymize: true,
    enableGdprRestriction: true,
    legalBasis: "legitimate_interest",
    privacyPolicyUrl: "",
    dpoContactEmail: "",
};

export default function ComplianceSettingsPanel() {
    const [config, setConfig] = useState<ComplianceConfig>(defaults);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch("/api/compliance/settings")
            .then(r => r.ok ? r.json() : defaults)
            .then(data => setConfig(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await fetch("/api/compliance/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (res.ok) setSaved(true);
        } catch {}
        setSaving(false);
        setTimeout(() => setSaved(false), 3000);
    };

    if (loading) {
        return <div style={{ padding: "24px", opacity: 0.5 }}>Loading compliance settings...</div>;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* HIPAA Section */}
            <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>🏥 HIPAA Settings</h3>
                
                <div style={fieldGroupStyle}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Data Retention Period (days)</label>
                        <input
                            type="number"
                            min={365}
                            max={9999}
                            value={config.dataRetentionDays}
                            onChange={(e) => setConfig(c => ({ ...c, dataRetentionDays: parseInt(e.target.value) || 2555 }))}
                            style={inputStyle}
                        />
                        <span style={hintStyle}>HIPAA requires minimum 6 years (2190 days). Default: ~7 years</span>
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Audit Log Retention (days)</label>
                        <input
                            type="number"
                            min={365}
                            max={9999}
                            value={config.auditRetentionDays}
                            onChange={(e) => setConfig(c => ({ ...c, auditRetentionDays: parseInt(e.target.value) || 2555 }))}
                            style={inputStyle}
                        />
                        <span style={hintStyle}>Must match or exceed data retention period</span>
                    </div>
                </div>

                <div style={fieldGroupStyle}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Session Timeout (minutes)</label>
                        <input
                            type="number"
                            min={5}
                            max={480}
                            value={config.sessionTimeoutMinutes}
                            onChange={(e) => setConfig(c => ({ ...c, sessionTimeoutMinutes: parseInt(e.target.value) || 15 }))}
                            style={inputStyle}
                        />
                        <span style={hintStyle}>HIPAA recommends 15 minutes or less</span>
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Idle Timeout (minutes)</label>
                        <input
                            type="number"
                            min={5}
                            max={480}
                            value={config.idleTimeoutMinutes}
                            onChange={(e) => setConfig(c => ({ ...c, idleTimeoutMinutes: parseInt(e.target.value) || 30 }))}
                            style={inputStyle}
                        />
                        <span style={hintStyle}>Auto-logout after inactivity</span>
                    </div>
                </div>
            </div>

            {/* GDPR Section */}
            <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>🇪🇺 GDPR Settings</h3>
                
                <div style={fieldGroupStyle}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Legal Basis for Processing</label>
                        <select
                            value={config.legalBasis}
                            onChange={(e) => setConfig(c => ({ ...c, legalBasis: e.target.value }))}
                            style={inputStyle}
                        >
                            <option value="legitimate_interest">Legitimate Interest</option>
                            <option value="consent">Patient Consent</option>
                            <option value="contract">Contractual Necessity</option>
                            <option value="legal_obligation">Legal Obligation</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                    <label style={toggleStyle}>
                        <input
                            type="checkbox"
                            checked={config.enableGdprExport}
                            onChange={(e) => setConfig(c => ({ ...c, enableGdprExport: e.target.checked }))}
                            style={{ marginRight: "8px" }}
                        />
                        <span>Enable Data Export (Article 20 — Right to Data Portability)</span>
                    </label>
                    <label style={toggleStyle}>
                        <input
                            type="checkbox"
                            checked={config.enableGdprRestriction}
                            onChange={(e) => setConfig(c => ({ ...c, enableGdprRestriction: e.target.checked }))}
                            style={{ marginRight: "8px" }}
                        />
                        <span>Enable Processing Restriction (Article 18 — Right to Restriction)</span>
                    </label>
                    <label style={toggleStyle}>
                        <input
                            type="checkbox"
                            checked={config.enableGdprAnonymize}
                            onChange={(e) => setConfig(c => ({ ...c, enableGdprAnonymize: e.target.checked }))}
                            style={{ marginRight: "8px" }}
                        />
                        <span>Enable Anonymization (Article 17 — Right to Erasure)</span>
                    </label>
                </div>

                <div style={{ ...fieldGroupStyle, marginTop: "16px" }}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>DPO Contact Email</label>
                        <input
                            type="email"
                            placeholder="dpo@yourhospital.com"
                            value={config.dpoContactEmail}
                            onChange={(e) => setConfig(c => ({ ...c, dpoContactEmail: e.target.value }))}
                            style={inputStyle}
                        />
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Privacy Policy URL</label>
                        <input
                            type="url"
                            placeholder="https://yourhospital.com/privacy"
                            value={config.privacyPolicyUrl}
                            onChange={(e) => setConfig(c => ({ ...c, privacyPolicyUrl: e.target.value }))}
                            style={inputStyle}
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: "10px 24px",
                        borderRadius: "8px",
                        border: "none",
                        background: saving ? "#6b7280" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: saving ? "default" : "pointer",
                        fontSize: "14px",
                        transition: "all 0.2s",
                    }}
                >
                    {saving ? "Saving..." : "Save Compliance Settings"}
                </button>
                {saved && (
                    <span style={{ color: "#22c55e", fontWeight: 500, animation: "fadeIn 0.3s" }}>
                        ✓ Settings saved
                    </span>
                )}
            </div>
        </div>
    );
}

const sectionStyle: React.CSSProperties = {
    padding: "20px",
    borderRadius: "12px",
    background: "var(--card-bg, rgba(255,255,255,0.05))",
    border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
};

const sectionTitleStyle: React.CSSProperties = {
    margin: "0 0 16px",
    fontSize: "16px",
    fontWeight: 600,
};

const fieldGroupStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "16px",
};

const fieldStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
};

const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 500,
    opacity: 0.8,
};

const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
    background: "var(--input-bg, rgba(255,255,255,0.05))",
    color: "inherit",
    fontSize: "14px",
};

const hintStyle: React.CSSProperties = {
    fontSize: "11px",
    opacity: 0.5,
};

const toggleStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    fontSize: "14px",
};
