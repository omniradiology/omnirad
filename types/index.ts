export type ReportStatus = 'Pending' | 'Approved' | 'Rejected' | 'Final';

export interface ReportFooter {
    prepared_by: string;
    department: string;
    report_status: ReportStatus;
    approved_by?: string;
    approved_at?: string;
    signature?: string;
    rejection_reason?: string;
}

export interface Comment {
    id: string;
    author: string;
    role: string;
    text: string;
    timestamp: string;
}

export interface AuditLog {
    id: string;
    action: string;
    user: string;
    timestamp: string;
    details?: string;
}

export interface PatientContext {
    fullName: string;
    patientId: string;
    age: number;
    gender: string;
    indication: string;
    symptoms: string;
    history: string;
    modality: string;
    image?: File | null;
    images?: File[];
    isDicom?: boolean;
    dicomMetadata?: any; // Will use DicomMetadata type
    isPacs?: boolean;
    pacsData?: any;
}

export interface Finding {
    anatomical_region: string;
    observation: string;
    status: "normal" | "abnormal";
}

export interface ReportData {
    report_header: {
        hospital_name: string;
        department: string;
        report_title: string;
        report_id: string;
        report_date: string;
    };
    patient: {
        name: string;
        patient_id?: string;
        age: number;
        gender: string;
    };
    clinical_information: {
        symptoms: string;
        history: string;
        indication: string;
    };
    study: {
        modality: string;
        examination: string;
        views: string;
    };
    findings: Finding[];
    impression: string[];
    urgency: "Routine" | "Urgent" | "Critical";
    recommendations: string[];
    report_footer: ReportFooter;
    disclaimer: string;
    image_data?: string; // Base64 encoded image
    images_data?: string[]; // Array of Base64 encoded images
    collaboration?: {
        comments: Comment[];
        logs: AuditLog[];
    };
    pacs_info?: {
        study_uid: string;
        series_uid: string;
        source: string;
    };
}

export interface DicomMetadata {
    patientName?: string;
    patientId?: string;
    patientBirthDate?: string;
    patientSex?: string;
    studyDate?: string;
    studyTime?: string;
    modality?: string;
    institutionName?: string;
    studyDescription?: string;
    seriesDescription?: string;
    bodyPartExamined?: string;
    referringPhysicianName?: string;
    accessionNumber?: string;
    transferSyntaxUID?: string;
    rows?: number;
    columns?: number;
    numberOfFrames?: number;
    bitsAllocated?: number;
}

export interface DicomExtractionResult {
    success: boolean;
    metadata?: DicomMetadata;
    images?: string[]; // Base64 JPEGs or Blob URLs
    error?: string;
}
