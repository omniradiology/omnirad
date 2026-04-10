"use client";

import React, { useState } from "react";
import { Patient } from "@/types";
import { User, Activity, FileText, Calendar, Trash2, Download } from "lucide-react";
import { useRouter } from "next/navigation";

export function PatientHeader({ patient, reportCount }: { patient: Patient, reportCount: number }) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this patient and all associated reports? This action cannot be undone.")) return;
        
        setIsDeleting(true);
        try {
            await fetch(`/api/patients/${patient.id}`, { method: 'DELETE' });
            router.push('/patients');
        } catch (e) {
            console.error("Failed to delete patient", e);
            setIsDeleting(false);
        }
    };

    const formatGender = (g?: string) => {
        if (!g) return null;
        const u = g.toUpperCase();
        if (u === 'M') return 'Male';
        if (u === 'F') return 'Female';
        if (u === 'O') return 'Other';
        return g;
    };

    const calculateAge = (dobString?: string) => {
        if (!dobString) return null;
        
        let birthDate: Date;
        if (dobString.length === 8 && !dobString.includes('-')) {
             const y = parseInt(dobString.substring(0,4));
             const m = parseInt(dobString.substring(4,6)) - 1;
             const d = parseInt(dobString.substring(6,8));
             birthDate = new Date(y, m, d);
        } else {
             birthDate = new Date(dobString);
        }
        
        if (isNaN(birthDate.getTime())) return null;
        
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const displayAge = calculateAge(patient.dob) ?? patient.age;
    const displayGender = formatGender(patient.gender);

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
            {/* Background design */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                <div className="flex items-start gap-5">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                        <span className="text-2xl font-bold text-indigo-300">
                            {patient.patientName.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                    
                    <div>
                        <h1 className="text-2xl font-semibold text-zinc-100">{patient.patientName}</h1>
                        <p className="text-zinc-400 mt-1 flex items-center gap-2">
                            <User className="w-4 h-4" /> 
                            {patient.patientIdNumber ? `ID: ${patient.patientIdNumber}` : 'No ID Number provided'}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-zinc-400" />
                                {displayGender || 'Unknown Gender'}
                            </span>
                            {displayAge !== null && (
                                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-zinc-400" />
                                    Age: {displayAge}
                                </span>
                            )}
                            {patient.dob && (
                                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-zinc-400" />
                                    DOB: {patient.dob.length === 8 && !patient.dob.includes('-') 
                                        ? `${patient.dob.substring(0,4)}/${patient.dob.substring(4,6)}/${patient.dob.substring(6,8)}` 
                                        : new Date(patient.dob).toLocaleDateString()}
                                </span>
                            )}
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5">
                                <FileText className="w-3 h-3 text-zinc-400" />
                                {reportCount} Total Reports
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Add export functionality if needed */}
                    <button 
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-2.5 text-zinc-400 hover:text-red-400 bg-zinc-950/50 hover:bg-red-500/10 border border-zinc-800 border-transparent rounded-xl transition-colors shrink-0"
                        title="Delete Patient"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
