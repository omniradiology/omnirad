"use client";

import { useState, useEffect, useRef } from "react";
import { Search, User, UserPlus, Loader2 } from "lucide-react";
import { Patient } from "@/types";

interface PatientSearchProps {
    onSelect: (patient: Patient) => void;
    onNewPatient: () => void;
    placeholder?: string;
    value?: string;
    onChange?: (val: string) => void;
}

export function PatientSearch({ onSelect, onNewPatient, placeholder = "Search patient by name or ID...", value = "", onChange }: PatientSearchProps) {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setQuery(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                }
            } catch (e) {
                console.error("Failed to search patients", e);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, isOpen]);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-zinc-500" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (onChange) onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-9 pr-10 py-2.5 text-sm 
                    focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-zinc-200"
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 w-4 h-4 text-zinc-400 animate-spin" />
                )}
            </div>

            {isOpen && (query.length > 0) && (
                <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {results.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto p-1">
                            {results.map((patient) => (
                                <button
                                    key={patient.id}
                                    onClick={() => {
                                        onSelect(patient);
                                        setQuery(patient.patientName);
                                        if (onChange) onChange(patient.patientName);
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/80 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-zinc-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-zinc-200 truncate">{patient.patientName}</div>
                                        <div className="text-xs text-zinc-500 truncate">
                                            {patient.patientIdNumber ? `ID: ${patient.patientIdNumber}` : 'No ID'}
                                            {patient.dob ? ` • DOB: ${patient.dob}` : ''}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        !isLoading && query.length >= 2 && (
                            <div className="p-4 text-center text-sm text-zinc-500">
                                No patients found matching "{query}"
                            </div>
                        )
                    )}
                    
                    <div className="border-t border-zinc-800 p-2 bg-zinc-900/50">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                onNewPatient();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            Create New Patient
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
