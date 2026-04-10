"use client";

import { useState, useEffect } from "react";
import { Users, Plus, LayoutGrid, List } from "lucide-react";
import { Patient } from "@/types";
import { PatientCard } from "@/components/patients/patient-card";
import Link from "next/link";
import { PatientSearch } from "@/components/patients/patient-search";
import { useRouter } from "next/navigation";

export default function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchPatients = async (search = "") => {
        setIsLoading(true);
        try {
            const url = search ? `/api/patients?search=${encodeURIComponent(search)}` : "/api/patients";
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setPatients(data);
            }
        } catch (e) {
            console.error("Failed to fetch patients", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const handleCreateNew = async () => {
        const name = prompt("Enter new patient's name:");
        if (!name) return;
        const idNumber = prompt("Enter patient ID number (optional):");

        try {
            const res = await fetch("/api/patients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientName: name, patientIdNumber: idNumber })
            });
            if (res.ok) {
                const newP = await res.json();
                router.push(`/patients/${newP.id}`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <main className="flex-1 p-6 lg:p-8 ml-20 h-screen overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
                            <Users className="text-indigo-400" />
                            Patient Records
                        </h1>
                        <p className="text-sm text-zinc-400 mt-1">Manage and view longitudinal patient histories</p>
                    </div>

                    <button 
                        onClick={handleCreateNew}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        New Patient
                    </button>
                </div>

                <div className="bg-bg-surface border border-border-primary rounded-2xl p-4 mb-8 shadow-sm">
                    <PatientSearch 
                        onSelect={(p) => router.push(`/patients/${p.id}`)}
                        onNewPatient={handleCreateNew}
                        onChange={(val) => {
                            if (val.length === 0) fetchPatients();
                        }}
                    />
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    </div>
                ) : patients.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {patients.map((p: any) => (
                            <PatientCard key={p.id} patient={p} reportCount={p.reportCount || 0} lastVisitDate={p.createdAt} latestStatus={p.reportCount > 0 ? "FINAL" : undefined} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                        <Users className="w-16 h-16 text-zinc-600 mb-4" />
                        <h3 className="text-lg font-medium text-zinc-300">No patients found</h3>
                        <p className="text-zinc-500 mt-2 text-center max-w-sm mb-6">Patient records are automatically created when you generate a report, or you can add one manually.</p>
                        <button onClick={handleCreateNew} className="text-indigo-400 hover:text-indigo-300 font-medium">
                            + Add Patient Manually
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
