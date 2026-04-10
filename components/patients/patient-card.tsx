import React from "react";
import { User, Calendar, FileText, Activity } from "lucide-react";
import { Patient } from "@/types";
import Link from "next/link";

export function PatientCard({ patient, reportCount = 0, lastVisitDate, latestStatus }: { patient: Patient, reportCount?: number, lastVisitDate?: string, latestStatus?: string }) {
    
    // Status color mapping
    const getStatusColor = (status?: string) => {
        if (!status) return "bg-zinc-500";
        const s = status.toUpperCase();
        if (s === 'APPROVED' || s === 'FINAL') return "bg-emerald-500";
        if (s === 'REJECTED') return "bg-red-500";
        return "bg-yellow-500";
    };

    const formatGender = (g?: string) => {
        if (!g) return null;
        const u = g.toUpperCase();
        if (u === 'M') return 'Male';
        if (u === 'F') return 'Female';
        return g;
    };

    const calculateAge = (dobString?: string) => {
        if (!dobString) return null;
        
        // Handle DICOM format YYYYMMDD
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
        <Link href={`/patients/${patient.id}`} className="block">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-5 hover:bg-zinc-800/40 hover:border-zinc-700/60 transition-all group">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <span className="text-lg font-semibold text-indigo-300">
                                {patient.patientName.substring(0, 2).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h3 className="font-medium text-zinc-100 group-hover:text-indigo-300 transition-colors">{patient.patientName}</h3>
                            <p className="text-xs text-zinc-500 mt-0.5">{patient.patientIdNumber ? `ID: ${patient.patientIdNumber}` : 'No ID provided'}</p>
                        </div>
                    </div>
                    {latestStatus && (
                        <div className="flex items-center gap-1.5" title={`Latest report: ${latestStatus}`}>
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(latestStatus)} animate-pulse`} />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-zinc-950/50 rounded-lg p-2.5 border border-zinc-800/40 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-zinc-500" />
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase font-semibold">Reports</p>
                            <p className="text-sm font-medium text-zinc-300">{reportCount}</p>
                        </div>
                    </div>
                    <div className="bg-zinc-950/50 rounded-lg p-2.5 border border-zinc-800/40 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase font-semibold">Last Scan</p>
                            <p className="text-sm font-medium text-zinc-300 truncate">{lastVisitDate ? new Date(lastVisitDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-800/40">
                    {displayGender && (
                        <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-300">
                            <Activity className="w-3.5 h-3.5 opacity-70" />
                            {displayGender}
                        </div>
                    )}
                    {displayAge !== null && (
                        <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-md text-xs font-medium text-purple-300">
                            <User className="w-3.5 h-3.5 opacity-70" />
                            {displayAge} years old
                        </div>
                    )}
                    {patient.dob && (
                        <div className="flex items-center gap-1.5 bg-zinc-800/50 border border-zinc-700/50 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300">
                            <Calendar className="w-3.5 h-3.5 opacity-70" />
                            DOB: {patient.dob.length === 8 && !patient.dob.includes('-') 
                                ? `${patient.dob.substring(0,4)}/${patient.dob.substring(4,6)}/${patient.dob.substring(6,8)}` 
                                : new Date(patient.dob).toLocaleDateString()}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
