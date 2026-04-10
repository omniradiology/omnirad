"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PatientHeader } from "@/components/patients/patient-header";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import { FileText, Clipboard, Settings, ArrowLeft, Edit2, Save, X, Check, ExternalLink } from "lucide-react";
import { Patient } from "@/types";
import Link from "next/link";

export default function PatientProfilePage() {
    const params = useParams();
    const id = params.id as string;
    
    const [patient, setPatient] = useState<Patient | null>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("timeline");
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Patient>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [pRes, rRes] = await Promise.all([
                    fetch(`/api/patients/${id}`),
                    fetch(`/api/patients/${id}/reports`)
                ]);
                
                if (pRes.ok) {
                    const data = await pRes.json();
                    setPatient(data);
                    setEditData(data); // Pre-fill edit state
                }
                if (rRes.ok) setReports(await rRes.json());
            } catch(e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        
        if (id) loadData();
    }, [id]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/patients/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData),
            });
            if (res.ok) {
                setPatient({ ...patient!, ...editData });
                setIsEditing(false);
            } else {
                alert("Failed to save patient information.");
            }
        } catch (e) {
            console.error("Save error:", e);
            alert("Error saving patient information.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <main className="flex-1 p-6 ml-20 h-screen flex justify-center items-center">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </main>
        );
    }

    if (!patient) {
        return (
            <main className="flex-1 p-6 ml-20 h-screen flex flex-col justify-center items-center text-zinc-400">
                <h1 className="text-xl font-bold mb-2">Patient Not Found</h1>
                <p>The patient record could not be loaded or has been deleted.</p>
            </main>
        );
    }

    return (
        <main className="flex-1 p-6 lg:p-8 ml-20 h-screen overflow-y-auto">
            <div className="max-w-5xl mx-auto">
                <Link href="/patients" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-zinc-700/80 px-3 py-1.5 rounded-lg transition-all mb-6 shadow-sm group w-fit">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    Back to Patients
                </Link>
                <PatientHeader patient={patient} reportCount={reports.length} />

                {/* Tabs */}
                <div className="flex items-center gap-1 mt-8 mb-6 border-b border-zinc-800">
                    <button 
                        onClick={() => setActiveTab("timeline")}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "timeline" ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
                    >
                        <FileText className="w-4 h-4" />
                        Report Timeline
                    </button>
                    <button 
                        onClick={() => setActiveTab("info")}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "info" ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
                    >
                        <Settings className="w-4 h-4" />
                        Patient Info
                    </button>
                    <button 
                        onClick={() => setActiveTab("notes")}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "notes" ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
                    >
                        <Clipboard className="w-4 h-4" />
                        Notes & History
                    </button>
                </div>

                {/* Tab Content */}
                <div className="pb-16">
                    {activeTab === "timeline" && (
                        <PatientTimeline reports={reports} />
                    )}
                    
                    {activeTab === "info" && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-medium text-zinc-200">Patient Demographics</h3>
                                {!isEditing ? (
                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setIsEditing(false); setEditData(patient!); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
                                            <X className="w-3.5 h-3.5" /> Cancel
                                        </button>
                                        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                                            {isSaving ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save className="w-3.5 h-3.5" />} 
                                            Save
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Fully editable layout */}
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Full Name</label>
                                    {isEditing ? (
                                        <input type="text" value={editData.patientName || ""} onChange={(e) => setEditData({...editData, patientName: e.target.value})} className="w-full bg-zinc-950 border border-indigo-500/50 focus:border-indigo-500 rounded-lg px-4 py-2 text-zinc-200 outline-none transition-colors" />
                                    ) : (
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300">{patient.patientName}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Patient ID Number</label>
                                    {isEditing ? (
                                         <input type="text" value={editData.patientIdNumber || ""} onChange={(e) => setEditData({...editData, patientIdNumber: e.target.value})} className="w-full bg-zinc-950 border border-indigo-500/50 focus:border-indigo-500 rounded-lg px-4 py-2 text-zinc-200 outline-none transition-colors" />
                                    ) : (
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300">{patient.patientIdNumber || "—"}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Age</label>
                                    {isEditing ? (
                                        <input type="number" value={editData.age || ""} onChange={(e) => setEditData({...editData, age: parseInt(e.target.value) || undefined})} className="w-full bg-zinc-950 border border-indigo-500/50 focus:border-indigo-500 rounded-lg px-4 py-2 text-zinc-200 outline-none transition-colors" placeholder="e.g. 26" />
                                    ) : (
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300">
                                            {(() => {
                                                if (!patient.dob) return null;
                                                let bd: Date;
                                                if (patient.dob.length === 8 && !patient.dob.includes("-")) {
                                                    bd = new Date(parseInt(patient.dob.substring(0,4)), parseInt(patient.dob.substring(4,6))-1, parseInt(patient.dob.substring(6,8)));
                                                } else {
                                                    bd = new Date(patient.dob);
                                                }
                                                if (isNaN(bd.getTime())) return null;
                                                const today = new Date();
                                                let age = today.getFullYear() - bd.getFullYear();
                                                const m = today.getMonth() - bd.getMonth();
                                                if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
                                                return age;
                                            })() ?? patient.age ?? "—"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Gender</label>
                                    {isEditing ? (
                                        <select value={editData.gender || ""} onChange={(e) => setEditData({...editData, gender: e.target.value})} className="w-full bg-zinc-950 border border-indigo-500/50 focus:border-indigo-500 rounded-lg px-4 py-2.5 text-zinc-200 outline-none transition-colors appearance-none cursor-pointer">
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    ) : (
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300">
                                            {patient.gender ? (
                                                patient.gender.toUpperCase() === "M" ? "Male" : 
                                                patient.gender.toUpperCase() === "F" ? "Female" : 
                                                patient.gender.toUpperCase() === "O" ? "Other" : patient.gender
                                            ) : "—"}
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Mobile Number</label>
                                    {isEditing ? (
                                         <input type="text" value={editData.mobile || ""} onChange={(e) => setEditData({...editData, mobile: e.target.value})} placeholder="+1 (555) 000-0000" className="w-full bg-zinc-950 border border-indigo-500/50 focus:border-indigo-500 rounded-lg px-4 py-2 text-zinc-200 outline-none transition-colors" />
                                    ) : (
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300">{patient.mobile || "—"}</div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Address</label>
                                    {isEditing ? (
                                         <input type="text" value={editData.address || ""} onChange={(e) => setEditData({...editData, address: e.target.value})} placeholder="123 Medical Pl, City, ST" className="w-full bg-zinc-950 border border-indigo-500/50 focus:border-indigo-500 rounded-lg px-4 py-2 text-zinc-200 outline-none transition-colors" />
                                    ) : (
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300">{patient.address || "—"}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "notes" && (
                        <div className="space-y-4">
                            {(() => {
                                // Extract all comments from all reports into a flattened array
                                const allComments: any[] = [];
                                reports.forEach(r => {
                                    const raw = r.report_data || r.reportData;
                                    let data: any = {};
                                    try {
                                        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                                    } catch (e) { console.error("Error parsing report data", e); }
                                    
                                    if (data?.collaboration?.comments && Array.isArray(data.collaboration.comments)) {
                                        data.collaboration.comments.forEach((comment: any) => {
                                            allComments.push({
                                                ...comment,
                                                reportId: r.id,
                                                modality: data.study?.modality || "Report",
                                                examination: data.study?.examination || "",
                                                status: data.report_footer?.report_status || "Reviewed",
                                                reportTimestamp: r.created_at || r.createdAt
                                            });
                                        });
                                    }
                                });

                                // Sort newest comments first naturally
                                allComments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                                if (allComments.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                                            <Clipboard className="w-12 h-12 text-zinc-600 mb-4 opacity-50" />
                                            <h3 className="text-lg font-medium text-zinc-300 mb-2">No Comments Found</h3>
                                            <p className="text-zinc-500 text-sm max-w-md">There are no reviewer comments or clinical notes associated with these reports yet.</p>
                                        </div>
                                    );
                                }

                                return allComments.map(comment => {
                                    const date = new Date(comment.timestamp);
                                    
                                    return (
                                        <div key={comment.id} className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-5 relative overflow-hidden shadow-sm">
                                            <div className={`absolute top-0 left-0 w-1 h-full ${comment.status.toLowerCase() === 'approved' ? 'bg-emerald-500/50' : comment.status.toLowerCase() === 'rejected' ? 'bg-red-500/50' : 'bg-indigo-500/50'}`} />
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50 shrink-0">
                                                        <Clipboard className="w-4 h-4 text-zinc-400" />
                                                    </div>
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-medium text-zinc-200">
                                                                Notes on <span className="text-indigo-300 font-bold">{comment.examination || comment.modality}</span>
                                                            </p>
                                                            <Link href={`/reports?id=${comment.reportId}`} className="text-[10px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-indigo-500/20">
                                                                Open Report <ExternalLink className="w-3 h-3" />
                                                            </Link>
                                                        </div>
                                                        <p className="text-xs text-zinc-500 mt-0.5">{date.toLocaleDateString()} at {date.toLocaleTimeString()}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2.5 py-1 rounded font-medium ${
                                                    comment.status.toLowerCase() === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                                    comment.status.toLowerCase() === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                                    'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                                }`}>{comment.status}</span>
                                            </div>
                                            <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800/40 mt-3 relative">
                                                <div className="flex items-start gap-2">
                                                    <FileText className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0 opacity-80" />
                                                    <div>
                                                        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{comment.author} {comment.role ? `(${comment.role})` : ""}</p>
                                                        <p className="text-sm text-zinc-300 italic leading-relaxed">"{comment.text}"</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
