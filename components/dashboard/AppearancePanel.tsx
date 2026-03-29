"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/basic"
import { CheckCircle } from "lucide-react"

interface AppearancePanelProps {
    onThemeChange?: (theme: string) => void;
    onTemplateChange?: (template: string) => void;
}

export function AppearancePanel({ onThemeChange, onTemplateChange }: AppearancePanelProps) {
    const [theme, setTheme] = React.useState("dark");
    const [selectedTemplate, setSelectedTemplate] = React.useState("standard");
    const [activeTemplate, setActiveTemplate] = React.useState("standard");
    const [hospitalName, setHospitalName] = React.useState("");
    const [logo, setLogo] = React.useState("");

    // Load saved settings from SQLite
    React.useEffect(() => {
        fetch('/api/settings?type=appearance')
            .then(res => res.json())
            .then(data => {
                setTheme(data.theme || "dark");
                const loadedTemplate = data.template || "standard";
                setSelectedTemplate(loadedTemplate);
                setActiveTemplate(loadedTemplate);
                setHospitalName(data.hospitalName || "");
                setLogo(data.logo || "");
            })
            .catch(e => console.error("Error loading appearance:", e));
    }, []);

    const saveSettings = (settings: any) => {
        fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'appearance', data: settings }),
        }).catch(e => console.error("Error saving appearance:", e));
    };

    const handleThemeChange = (newTheme: string) => {
        setTheme(newTheme);
        saveSettings({ theme: newTheme, template: activeTemplate, hospitalName, logo });
        onThemeChange?.(newTheme);

        if (newTheme === "light") {
            document.documentElement.classList.remove("dark");
        } else {
            document.documentElement.classList.add("dark");
        }
    };

    const handleTemplateSelect = (newTemplate: string) => {
        setSelectedTemplate(newTemplate);
    };

    const handleActivateTemplate = () => {
        setActiveTemplate(selectedTemplate);
        saveSettings({ theme, template: selectedTemplate, hospitalName, logo });
        onTemplateChange?.(selectedTemplate);
    };

    const handleBrandingChange = (field: "hospitalName" | "logo", value: string) => {
        const updates = { theme, template: selectedTemplate, hospitalName, logo };
        updates[field] = value;

        if (field === "hospitalName") setHospitalName(value);
        if (field === "logo") setLogo(value);

        saveSettings(updates);
    };

    return (
        <Card className="bg-bg-surface border-border-primary">
            <CardHeader>
                <CardTitle className="text-text-heading">Appearance</CardTitle>
                <p className="text-sm text-text-secondary">Customize the look and feel of OpenRad</p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Theme Selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Theme</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleThemeChange("dark")}
                            className={`p-4 rounded-lg border-2 transition-all ${theme === "dark"
                                ? "border-primary-main bg-primary-main/10"
                                : "border-border-primary bg-bg-panel hover:border-primary-main/50"
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-gray-900 border border-gray-700"></div>
                                <span className="text-sm font-medium text-text-primary">Dark Mode</span>
                            </div>
                        </button>
                        <button
                            onClick={() => handleThemeChange("light")}
                            className={`p-4 rounded-lg border-2 transition-all ${theme === "light"
                                ? "border-primary-main bg-primary-main/10"
                                : "border-border-primary bg-bg-panel hover:border-primary-main/50"
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-white border border-gray-300"></div>
                                <span className="text-sm font-medium text-text-primary">Light Mode</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Report Template Selector */}
                <div className="space-y-6 pt-6 border-t border-border-primary">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-base font-bold text-text-heading">Report Template Design</h4>
                            <p className="text-xs text-text-muted mt-1">Choose a visual style for your reports</p>
                        </div>
                        {selectedTemplate !== activeTemplate && (
                            <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full animate-pulse">
                                Changes not saved
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Standard Template Card */}
                        <div
                            className={`cursor-pointer group relative rounded-xl border-2 transition-all duration-200 overflow-hidden ${selectedTemplate === 'standard'
                                ? 'border-primary-main ring-2 ring-primary-main/20 bg-primary-main/5'
                                : 'border-border-primary hover:border-primary-main/50 hover:bg-bg-surface'
                                }`}
                            onClick={() => handleTemplateSelect('standard')}
                        >
                            <div className="aspect-[3/4] w-full bg-white p-3 pointer-events-none relative shadow-inner">
                                <div className="h-full w-full border border-gray-100 flex flex-col p-2 scale-90 origin-top">
                                    <div className="border-b-2 border-gray-800 pb-1 mb-2">
                                        <div className="h-2 w-3/4 bg-gray-900 mb-1 rounded-sm"></div>
                                        <div className="h-1 w-1/2 bg-gray-500 rounded-sm"></div>
                                    </div>
                                    <div className="flex gap-1 mb-2">
                                        <div className="w-1/2 h-8 bg-gray-100 rounded-sm"></div>
                                        <div className="w-1/2 h-8 bg-gray-100 rounded-sm"></div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-1 w-1/3 bg-gray-800 mb-1 rounded-sm"></div>
                                        <div className="h-0.5 w-full bg-gray-300 mb-2"></div>
                                        <div className="space-y-1">
                                            <div className="h-1 w-full bg-gray-200 rounded-sm"></div>
                                            <div className="h-1 w-5/6 bg-gray-200 rounded-sm"></div>
                                            <div className="h-1 w-full bg-gray-200 rounded-sm"></div>
                                        </div>
                                    </div>
                                    <div className="mt-auto pt-2 border-t-2 border-gray-800 flex justify-between">
                                        <div className="h-2 w-8 bg-gray-300 rounded-sm"></div>
                                        <div className="h-6 w-12 border border-dashed border-gray-300 rounded-sm"></div>
                                    </div>
                                </div>
                                {selectedTemplate === 'standard' && (
                                    <div className="absolute inset-0 bg-primary-main/5 pointer-events-none" />
                                )}
                            </div>
                            <div className="p-3 border-t border-border-primary bg-bg-panel/50">
                                <div className="flex justify-between items-center mb-1">
                                    <p className={`font-bold text-sm ${selectedTemplate === 'standard' ? 'text-primary-main' : 'text-text-primary'}`}>Standard</p>
                                    {activeTemplate === 'standard' && <CheckCircle size={14} className="text-green-600" />}
                                </div>
                                <p className="text-[10px] text-text-muted leading-tight">Classic medical serif design with gray visual blocks. Professional &amp; Authoritative.</p>
                            </div>
                        </div>

                        {/* Modern Template Card */}
                        <div
                            className={`cursor-pointer group relative rounded-xl border-2 transition-all duration-200 overflow-hidden ${selectedTemplate === 'modern'
                                ? 'border-primary-main ring-2 ring-primary-main/20 bg-primary-main/5'
                                : 'border-border-primary hover:border-primary-main/50 hover:bg-bg-surface'
                                }`}
                            onClick={() => handleTemplateSelect('modern')}
                        >
                            <div className="aspect-[3/4] w-full bg-white p-3 pointer-events-none relative shadow-inner">
                                <div className="h-full w-full flex flex-col scale-90 origin-top bg-white">
                                    <div className="bg-slate-900 h-8 w-full mb-2 p-1 flex flex-col justify-center">
                                        <div className="h-1.5 w-1/2 bg-white/20 rounded-sm mb-0.5"></div>
                                        <div className="h-1 w-1/3 bg-white/10 rounded-sm"></div>
                                    </div>
                                    <div className="h-6 w-full bg-slate-100 mb-2 rounded-sm border-b border-slate-200"></div>
                                    <div className="space-y-2 px-1">
                                        <div className="border border-slate-100 rounded bg-white p-1 shadow-sm">
                                            <div className="h-1 w-1/4 bg-blue-500 mb-1 rounded-full"></div>
                                            <div className="h-1 w-full bg-slate-100 rounded-sm"></div>
                                        </div>
                                        <div className="border border-red-50 rounded bg-red-50/20 p-1">
                                            <div className="flex justify-between mb-1">
                                                <div className="h-1 w-1/4 bg-slate-800 rounded-sm"></div>
                                                <div className="h-1 w-6 bg-red-200 rounded-full"></div>
                                            </div>
                                            <div className="h-1 w-full bg-red-100/50 rounded-sm"></div>
                                        </div>
                                    </div>
                                </div>
                                {selectedTemplate === 'modern' && (
                                    <div className="absolute inset-0 bg-primary-main/5 pointer-events-none" />
                                )}
                            </div>
                            <div className="p-3 border-t border-border-primary bg-bg-panel/50">
                                <div className="flex justify-between items-center mb-1">
                                    <p className={`font-bold text-sm ${selectedTemplate === 'modern' ? 'text-primary-main' : 'text-text-primary'}`}>Modern</p>
                                    {activeTemplate === 'modern' && <CheckCircle size={14} className="text-green-600" />}
                                </div>
                                <p className="text-[10px] text-text-muted leading-tight">Digital-first sans-serif with bold blue header &amp; cards. High contrast.</p>
                            </div>
                        </div>

                        {/* Minimal Template Card */}
                        <div
                            className={`cursor-pointer group relative rounded-xl border-2 transition-all duration-200 overflow-hidden ${selectedTemplate === 'minimal'
                                ? 'border-primary-main ring-2 ring-primary-main/20 bg-primary-main/5'
                                : 'border-border-primary hover:border-primary-main/50 hover:bg-bg-surface'
                                }`}
                            onClick={() => handleTemplateSelect('minimal')}
                        >
                            <div className="aspect-[3/4] w-full bg-white p-3 pointer-events-none relative shadow-inner">
                                <div className="h-full w-full flex flex-col p-1 font-mono scale-90 origin-top">
                                    <div className="flex justify-between border-b border-black pb-1 mb-1">
                                        <div className="h-1.5 w-1/3 bg-black rounded-sm"></div>
                                        <div className="h-1 w-1/4 bg-gray-400 rounded-sm"></div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1 border-b border-black pb-2 mb-2">
                                        <div className="h-2 bg-gray-100"></div>
                                        <div className="h-2 bg-gray-100"></div>
                                        <div className="h-2 bg-gray-100"></div>
                                        <div className="h-2 bg-gray-100"></div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex gap-1 border-b border-gray-100 pb-0.5">
                                            <div className="w-4 h-1 bg-gray-400"></div>
                                            <div className="w-full h-1 bg-gray-200"></div>
                                        </div>
                                        <div className="flex gap-1 border-b border-gray-100 pb-0.5">
                                            <div className="w-4 h-1 bg-gray-400"></div>
                                            <div className="w-full h-1 bg-gray-200"></div>
                                        </div>
                                        <div className="flex gap-1 border-b border-gray-100 pb-0.5">
                                            <div className="w-4 h-1 bg-gray-400"></div>
                                            <div className="w-full h-1 bg-gray-200"></div>
                                        </div>
                                    </div>
                                    <div className="mt-auto border-t border-black pt-1 flex justify-between items-end">
                                        <div className="h-1 w-10 bg-gray-300"></div>
                                        <div className="flex flex-col items-end">
                                            <div className="h-3 w-8 bg-gray-200 mb-0.5"></div>
                                            <div className="h-1 w-12 bg-black"></div>
                                        </div>
                                    </div>
                                </div>
                                {selectedTemplate === 'minimal' && (
                                    <div className="absolute inset-0 bg-primary-main/5 pointer-events-none" />
                                )}
                            </div>
                            <div className="p-3 border-t border-border-primary bg-bg-panel/50">
                                <div className="flex justify-between items-center mb-1">
                                    <p className={`font-bold text-sm ${selectedTemplate === 'minimal' ? 'text-primary-main' : 'text-text-primary'}`}>Minimal</p>
                                    {activeTemplate === 'minimal' && <CheckCircle size={14} className="text-green-600" />}
                                </div>
                                <p className="text-[10px] text-text-muted leading-tight">Compact A4 optimized layout. Dense data grid &amp; minimal whitespace.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleActivateTemplate}
                            disabled={selectedTemplate === activeTemplate}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all transform active:scale-95 ${selectedTemplate === activeTemplate
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-primary-main text-white hover:bg-primary-dark shadow-md hover:shadow-lg'
                                }`}
                        >
                            {selectedTemplate === activeTemplate ? 'Template Active' : 'Activate Template'}
                        </button>
                    </div>
                </div>

                {/* Hospital Branding */}
                <div className="space-y-4 pt-4 border-t border-border-primary">
                    <h4 className="text-sm font-semibold text-text-heading">Hospital Branding</h4>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">Hospital Name</label>
                        <input
                            type="text"
                            value={hospitalName}
                            onChange={(e) => handleBrandingChange("hospitalName", e.target.value)}
                            placeholder="General Hospital"
                            className="w-full px-4 py-2 bg-bg-panel border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-main"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">Logo URL</label>
                        <input
                            type="text"
                            value={logo}
                            onChange={(e) => handleBrandingChange("logo", e.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="w-full px-4 py-2 bg-bg-panel border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-main"
                        />
                        <p className="text-xs text-text-muted">Enter a URL for your hospital logo (appears on reports)</p>
                        {logo && (
                            <div className="mt-2 p-2 bg-bg-panel border border-border-primary rounded">
                                <p className="text-xs text-text-muted mb-1">Preview:</p>
                                <img src={logo} alt="Logo preview" className="max-h-16 object-contain" />
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
