"use client"

import * as React from "react"
import dynamic from 'next/dynamic'
import { Upload, X, Loader2, FileCheck2, Info } from "lucide-react"
import { Card, CardContent, Input, Label, Textarea, Button } from "@/components/ui/basic"
import { PatientContext, DicomMetadata } from "@/types"
import { parseDicomMetadata } from "@/lib/dicomMetadataParser"
import { DicomViewerHandle } from "./DicomViewer"

// Client-only dynamic import for the DICOM canvas viewer (no SSR)
const DicomViewer = dynamic(() => import('./DicomViewer').then(m => m.DicomViewer), { 
    ssr: false, 
    loading: () => <div className="flex bg-[#0a0b0e] border border-white/10 rounded-lg items-center justify-center h-full min-h-[300px] text-white/50"><Loader2 className="animate-spin w-8 h-8 opacity-60" /></div> 
});

interface PatientFormProps {
    onSubmit: (data: PatientContext, dicomRef?: React.RefObject<DicomViewerHandle | null>) => void;
    isGenerating: boolean;
}

export function PatientForm({ onSubmit, isGenerating }: PatientFormProps) {
    const [activeTab, setActiveTab] = React.useState<'manual' | 'dicom'>('manual');
    const [dragActive, setDragActive] = React.useState(false)
    const [formData, setFormData] = React.useState<PatientContext>({
        fullName: "",
        age: 0,
        gender: "M",
        indication: "",
        symptoms: "",
        history: "",
        modality: "X-Ray",
        image: null,
        images: []
    });

    // DICOM State
    const [isDicomProcessing, setIsDicomProcessing] = React.useState(false);
    const [dicomFile, setDicomFile] = React.useState<File | null>(null);
    const [dicomMeta, setDicomMeta] = React.useState<DicomMetadata | null>(null);
    const dicomViewerRef = React.useRef<DicomViewerHandle>(null);
    
    // Refs
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const dicomInputRef = React.useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: id === 'age' ? parseInt(value) || 0 : value }));
    }

    // -- STANDARD MANUAL UPLOAD --
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFormData(prev => {
                const updatedImages = [...(prev.images || []), ...newFiles];
                return { ...prev, image: updatedImages[0], images: updatedImages };
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }
    const removeFile = (indexToRemove: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setFormData(prev => {
            const newImages = (prev.images || []).filter((_, i) => i !== indexToRemove);
            return {
                ...prev,
                images: newImages,
                image: newImages.length > 0 ? newImages[0] : null
            };
        });
    };
    const handleUploadClick = () => fileInputRef.current?.click();

    // -- DICOM UPLOAD FLOW --
    const calculateAge = (dobStr: string): number => {
        if (!dobStr || dobStr.length < 8) return 0;
        const year = parseInt(dobStr.substring(0, 4), 10);
        return new Date().getFullYear() - year;
    }

    const processDicomFiles = async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        const targetFile = files[0];
        
        setIsDicomProcessing(true);
        const result = await parseDicomMetadata(targetFile);
        setIsDicomProcessing(false);

        if (result.success && result.metadata) {
            setDicomFile(targetFile);
            setDicomMeta(result.metadata);
            
            // Auto-fill empty fields based on DICOM meta
            setFormData(prev => {
                let defaultIndication = prev.indication;
                if (!defaultIndication) {
                    const descParts = [];
                    if (result.metadata?.studyDescription) descParts.push(result.metadata.studyDescription);
                    if (result.metadata?.seriesDescription) descParts.push(result.metadata.seriesDescription);
                    if (descParts.length > 0) defaultIndication = descParts.join(' - ');
                }

                let matchedModality = prev.modality;
                if (result.metadata?.modality) {
                    matchedModality = result.metadata.modality;
                }

                return {
                    ...prev,
                    fullName: prev.fullName || result.metadata?.patientName || "",
                    age: prev.age || (result.metadata?.patientBirthDate ? calculateAge(result.metadata.patientBirthDate) : 0),
                    gender: prev.gender || (result.metadata?.patientSex === 'F' ? 'F' : 'M'),
                    modality: matchedModality,
                    indication: defaultIndication,
                };
            });
            
            if (dicomInputRef.current) dicomInputRef.current.value = '';
        } else {
            alert(result.error || "Could not parse DICOM file.");
        }
    };
    const handleDicomFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processDicomFiles(e.target.files);
    }
    const removeDicomFile = () => {
        setDicomFile(null);
        setDicomMeta(null);
    }


    // -- SHARED DRAG & DROP --
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    }
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (activeTab === 'manual') {
                const newFiles = Array.from(e.dataTransfer.files);
                setFormData(prev => {
                    const up = [...(prev.images || []), ...newFiles];
                    return { ...prev, image: up[0], images: up };
                });
            } else {
                processDicomFiles(e.dataTransfer.files);
            }
        }
    }

    const handleSubmit = () => {
        if (activeTab === 'dicom') {
            onSubmit({ ...formData, image: dicomFile, images: dicomFile ? [dicomFile] : [], isDicom: true, dicomMetadata: dicomMeta }, dicomViewerRef as any);
        } else {
            onSubmit(formData);
        }
    }

    // Helper: field status badge for DICOM auto-fill
    const FieldBadge = ({ filled }: { filled: boolean }) => (
        filled 
            ? <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-medium ml-2">✓ DICOM</span>
            : <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-medium ml-2">Required</span>
    );

    const isDicomLoaded = activeTab === 'dicom' && dicomFile && dicomMeta;

    // ---- RENDER ----
    return (
        <div className="h-full flex flex-col gap-6 p-6">
            <div className="space-y-3">
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold text-text-heading">Case Details</h2>
                    <p className="text-text-secondary text-sm">Enter patient and study information</p>
                </div>
                
                {/* Mode Switcher */}
                <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveTab('manual')}
                        className={`px-4 py-1.5 rounded-md border text-sm font-medium transition-all ${
                            activeTab === 'manual' ? 'bg-blue-600/10 border-blue-500 text-blue-500 shadow-sm' : 'bg-transparent border-border-primary text-text-muted hover:text-text-primary hover:border-text-muted'
                        }`}>
                        Manual
                    </button>
                    <button type="button" onClick={() => setActiveTab('dicom')}
                        className={`px-4 py-1.5 rounded-md border text-sm font-medium transition-all ${
                            activeTab === 'dicom' ? 'bg-blue-600/10 border-blue-500 text-blue-500 shadow-sm' : 'bg-transparent border-border-primary text-text-muted hover:text-text-primary hover:border-text-muted'
                        }`}>
                        DICOM
                    </button>
                </div>
            </div>

            <Card className="flex-1 overflow-auto bg-bg-surface border-border-primary">
                <CardContent className="space-y-6 pt-6">

                    {/* ══════════════ MANUAL TAB ══════════════ */}
                    {activeTab === 'manual' && (
                        <>
                            {/* Patient Information */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Patient Information</h3>
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-6">
                                        <Label htmlFor="fullName">Full Name *</Label>
                                        <Input id="fullName" placeholder="e.g. John Doe" value={formData.fullName} onChange={handleChange} />
                                    </div>
                                    <div className="col-span-6 md:col-span-3">
                                        <Label htmlFor="age">Age *</Label>
                                        <Input id="age" placeholder="00" type="number" value={formData.age || ''} onChange={handleChange} />
                                    </div>
                                    <div className="col-span-6 md:col-span-3">
                                        <Label htmlFor="gender">Gender</Label>
                                        <select id="gender" className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" value={formData.gender} onChange={handleChange}>
                                            <option value="M">Male</option>
                                            <option value="F">Female</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Clinical Context */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Clinical Context</h3>
                                <div>
                                    <Label htmlFor="indication">Indication *</Label>
                                    <Input id="indication" placeholder="e.g. Rule out pneumonia" value={formData.indication} onChange={handleChange} />
                                </div>
                                <div>
                                    <Label htmlFor="symptoms">Symptoms</Label>
                                    <Input id="symptoms" placeholder="e.g. Cough, fever" value={formData.symptoms} onChange={handleChange} />
                                </div>
                                <div>
                                    <Label htmlFor="history">Patient History</Label>
                                    <Textarea id="history" placeholder="Relevant medical history..." className="resize-none h-20" value={formData.history} onChange={handleChange} />
                                </div>
                            </div>

                            {/* Study Details */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Study Details</h3>
                                <div>
                                    <Label htmlFor="modality">Modality *</Label>
                                    <Input id="modality" list="modality-options" placeholder="e.g. X-Ray, CT, MRI" value={formData.modality} onChange={handleChange} />
                                    <datalist id="modality-options">
                                        <option value="X-Ray" />
                                        <option value="CT" />
                                        <option value="MRI" />
                                        <option value="Ultrasound" />
                                    </datalist>
                                </div>
                            </div>

                            {/* Medical Image Upload */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Medical Image</h3>
                                <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileChange} />
                                <div
                                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-border-card hover:bg-bg-panel'}`}
                                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={handleUploadClick}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="p-3 rounded-full bg-bg-panel">
                                            <Upload className="w-6 h-6 text-text-muted" />
                                        </div>
                                        {formData.images && formData.images.length > 0 ? (
                                            <div className="flex flex-col gap-2 w-full mt-2">
                                                {formData.images.map((file, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 bg-bg-primary border border-border-primary rounded-md">
                                                        <span className="text-sm text-text-primary truncate max-w-[200px]">{file.name}</span>
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={(e) => removeFile(idx, e)}><X className="w-4 h-4" /></Button>
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUploadClick(); }} className="mt-2 w-fit mx-auto">Add More Files</Button>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium text-text-primary"><span>Drag & drop images here or <span className="text-primary hover:underline">browse</span></span></p>
                                        )}
                                        <p className="text-xs text-text-muted mt-2">Supports JPEG, PNG, PDF (max 8MB)</p>
                                    </div>
                                </div>
                            </div>

                            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isGenerating || (!formData.images || formData.images.length === 0)}>
                                {isGenerating ? "Processing..." : "Generate Report"}
                            </Button>
                        </>
                    )}

                    {/* ══════════════ DICOM TAB ══════════════ */}
                    {activeTab === 'dicom' && (
                        <>
                            {/* DICOM Upload / Viewer */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">DICOM View Engine</h3>
                                <input ref={dicomInputRef} type="file" accept=".dcm,.dicom" className="hidden" onChange={handleDicomFileInput} />
                                
                                {!dicomFile ? (
                                    /* ── PHASE 1: Empty upload dropzone ── */
                                    <div 
                                       className={`min-h-[400px] border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-border-card hover:bg-bg-panel'}`}
                                       onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => dicomInputRef.current?.click()}
                                    >
                                        {isDicomProcessing ? (
                                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                                        ) : (
                                            <div className="p-5 rounded-full bg-bg-panel mb-5 shadow-sm border border-border-primary group-hover:scale-110 transition-transform">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/>
                                                </svg>
                                            </div>
                                        )}
                                        <h4 className="text-lg font-medium text-text-primary mb-1">
                                            {isDicomProcessing ? "Parsing DICOM metadata..." : "Upload DICOM File"}
                                        </h4>
                                        <p className="text-sm text-text-muted max-w-xs mb-2">
                                            Drag and drop a DICOM file (.dcm) here or click to browse.
                                        </p>
                                        <p className="text-xs text-text-muted/60">
                                            Patient data and study details will be extracted automatically.
                                        </p>
                                    </div>
                                ) : (
                                    /* ── PHASE 2: File loaded — viewer + extracted form ── */
                                    <div className="space-y-3">
                                        {/* File info bar */}
                                        <div className="flex items-center justify-between p-2 bg-[#111318] rounded-md border border-white/10 shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden px-2">
                                                <FileCheck2 className="w-5 h-5 text-blue-400 shrink-0" />
                                                <div className="flex flex-col truncate">
                                                    <span className="text-sm font-medium text-white/90 truncate">{dicomFile.name}</span>
                                                    <span className="text-[10px] text-white/40">{dicomMeta?.modality} • {dicomMeta?.transferSyntaxUID?.includes('1.2.4.50') ? 'JPEG' : 'RAW'} • {dicomMeta?.columns}x{dicomMeta?.rows}</span>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={removeDicomFile} className="text-white/40 hover:text-white" title="Remove">
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        {/* WebGL Viewport */}
                                        <div className="w-full h-[350px] border border-white/10 rounded-lg overflow-hidden relative shadow-lg group shadow-black/50">
                                            <DicomViewer 
                                                ref={dicomViewerRef}
                                                file={dicomFile} 
                                                className="w-full h-full"
                                            />
                                            <div className="absolute top-2 left-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="bg-black/80 backdrop-blur text-[10px] text-white/70 px-2 py-1 rounded shadow-xl border border-white/10">
                                                    Left-drag: W/L · Right: Pan · Mid: Zoom 
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── PHASE 2 continued: Extracted fields (only visible after upload) ── */}
                            {isDicomLoaded && (
                                <>
                                    {/* Patient Info — auto-filled */}
                                    <div className="space-y-4 border-t border-white/5 pt-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Patient Information</h3>
                                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded flex items-center gap-1"><Info className="w-3 h-3"/> Extracted from DICOM</span>
                                        </div>
                                        <div className="grid grid-cols-12 gap-4">
                                            <div className="col-span-12 md:col-span-6">
                                                <Label htmlFor="fullName">Full Name * <FieldBadge filled={!!formData.fullName} /></Label>
                                                <Input id="fullName" placeholder="e.g. John Doe" value={formData.fullName} onChange={handleChange} />
                                            </div>
                                            <div className="col-span-6 md:col-span-3">
                                                <Label htmlFor="age">Age * <FieldBadge filled={!!formData.age} /></Label>
                                                <Input id="age" placeholder="00" type="number" value={formData.age || ''} onChange={handleChange} />
                                            </div>
                                            <div className="col-span-6 md:col-span-3">
                                                <Label htmlFor="gender">Gender <FieldBadge filled={true} /></Label>
                                                <select id="gender" className="flex h-10 w-full rounded-md border border-border-primary bg-bg-panel px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" value={formData.gender} onChange={handleChange}>
                                                    <option value="M">Male</option>
                                                    <option value="F">Female</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Clinical Context — mostly manual */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Clinical Context</h3>
                                        <div>
                                            <Label htmlFor="indication">Indication * <FieldBadge filled={!!formData.indication} /></Label>
                                            <Input id="indication" placeholder="e.g. Rule out pneumonia" value={formData.indication} onChange={handleChange} />
                                        </div>
                                        <div>
                                            <Label htmlFor="symptoms">Symptoms <FieldBadge filled={!!formData.symptoms} /></Label>
                                            <Input id="symptoms" placeholder="e.g. Cough, fever" value={formData.symptoms} onChange={handleChange} />
                                        </div>
                                        <div>
                                            <Label htmlFor="history">Patient History <FieldBadge filled={!!formData.history} /></Label>
                                            <Textarea id="history" placeholder="Relevant medical history..." className="resize-none h-20" value={formData.history} onChange={handleChange} />
                                        </div>
                                    </div>

                                    {/* Study Details — auto-filled */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Study Details</h3>
                                        <div>
                                            <Label htmlFor="modality">Modality * <FieldBadge filled={!!formData.modality} /></Label>
                                            <Input id="modality" list="modality-options" placeholder="e.g. X-Ray, CT, MRI" value={formData.modality} onChange={handleChange} />
                                            {/* (Datalist is already defined in the manual tab above, but having a duplicate or single shared one works fine. Browsers attach via ID) */}
                                        </div>
                                    </div>

                                    <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isGenerating}>
                                        {isGenerating ? "Processing AI Analysis..." : "Generate Report"}
                                    </Button>
                                </>
                            )}
                        </>
                    )}

                </CardContent>
            </Card>
        </div>
    )
}
