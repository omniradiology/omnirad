import React, { useState } from "react";
import { Input, Label, Button } from "@/components/ui/basic";
import { Search, RotateCcw } from "lucide-react";

interface PacsSearchFiltersProps {
    onSearch: (filters: Record<string, string>) => void;
    isLoading?: boolean;
}

export function PacsSearchFilters({ onSearch, isLoading = false }: PacsSearchFiltersProps) {
    const [filters, setFilters] = useState<Record<string, string>>({
        PatientName: "",
        PatientID: "",
        StudyDate: "",
        Modality: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApply = () => {
        // Strip out empty filters before sending request
        const appliedFilters: Record<string, string> = {};
        Object.entries(filters).forEach(([key, val]) => {
            if (val.trim() !== "") {
                appliedFilters[key] = val;
            }
        });
        onSearch(appliedFilters);
    };

    const handleClear = () => {
        setFilters({ PatientName: "", PatientID: "", StudyDate: "", Modality: "" });
        onSearch({});
    };

    return (
        <div className="space-y-6">
            <div>
                <Label htmlFor="PatientName">Patient Name</Label>
                <Input 
                    type="text" 
                    id="PatientName" 
                    name="PatientName"
                    placeholder="e.g. *Doe*" 
                    value={filters.PatientName} 
                    onChange={handleChange} 
                />
            </div>

            <div>
                <Label htmlFor="PatientID">Patient ID</Label>
                <Input 
                    type="text" 
                    id="PatientID" 
                    name="PatientID"
                    placeholder="12345" 
                    value={filters.PatientID} 
                    onChange={handleChange} 
                />
            </div>

            <div>
                <Label htmlFor="StudyDate">Study Date</Label>
                <Input 
                    type="text" 
                    id="StudyDate" 
                    name="StudyDate"
                    placeholder="YYYYMMDD (or empty)" 
                    value={filters.StudyDate} 
                    onChange={handleChange} 
                />
            </div>

            <div>
                <Label htmlFor="Modality">Modality</Label>
                <select
                    id="Modality"
                    name="Modality"
                    value={filters.Modality}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel px-3 py-2 text-sm text-text-primary mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <option value="">Any</option>
                    <option value="CR">CR - Computed Radiography</option>
                    <option value="CT">CT - Computed Tomography</option>
                    <option value="MR">MR - Magnetic Resonance</option>
                    <option value="US">US - Ultrasound</option>
                    <option value="DX">DX - Digital Radiography</option>
                    <option value="PX">PX - Panoramic X-Ray</option>
                </select>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border-primary">
                <Button 
                    variant="outline" 
                    className="flex-1" 
                    onClick={handleClear}
                    disabled={isLoading}
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                </Button>
                <Button 
                    className="flex-1" 
                    onClick={handleApply}
                    disabled={isLoading}
                >
                    <Search className="w-4 h-4 mr-2" />
                    {isLoading ? "Searching..." : "Search"}
                </Button>
            </div>
        </div>
    );
}
