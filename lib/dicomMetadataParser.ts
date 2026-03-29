import * as dicomParser from 'dicom-parser';
import { DicomMetadata, DicomExtractionResult } from '@/types';

// Helper to safely extract and trim string values
function getString(dataSet: dicomParser.DataSet, tag: string): string | undefined {
    const val = dataSet.string(tag);
    if (val) return val.trim();
    return undefined;
}

// Helper to safely extract numeric values
function getNumber(dataSet: dicomParser.DataSet, tag: string): number | undefined {
    // Try uint16 first, which is common for rows/cols/bits
    try {
        const val = dataSet.uint16(tag);
        if (val !== undefined && !isNaN(val)) return val;
        
        const val32 = dataSet.uint32(tag);
        if (val32 !== undefined && !isNaN(val32)) return val32;
    } catch (e) {
        // Tag might missing or wrong type
    }
    return undefined;
}

export async function parseDicomMetadata(file: File): Promise<DicomExtractionResult> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const byteArray = new Uint8Array(arrayBuffer);
        
        // Parse the DICOM file
        // This throws if the file is not a valid DICOM file
        const dataSet = dicomParser.parseDicom(byteArray);
        
        // Extract required tags
        const metadata: DicomMetadata = {
            patientName: getString(dataSet, 'x00100010'),
            patientId: getString(dataSet, 'x00100020'),
            patientBirthDate: getString(dataSet, 'x00100030'),
            patientSex: getString(dataSet, 'x00100040'),
            modality: getString(dataSet, 'x00080060'),
            studyDate: getString(dataSet, 'x00080020'),
            studyTime: getString(dataSet, 'x00080030'),
            institutionName: getString(dataSet, 'x00080080'),
            studyDescription: getString(dataSet, 'x00081030'),
            seriesDescription: getString(dataSet, 'x0008103e'),
            bodyPartExamined: getString(dataSet, 'x00180015'),
            referringPhysicianName: getString(dataSet, 'x00080090'),
            accessionNumber: getString(dataSet, 'x00080050'),
            
            // Note: transfer syntax is technically in the File Meta Information (x00020010)
            // dicom-parser handles this if Part 10 file format.
            transferSyntaxUID: getString(dataSet, 'x00020010'), 
            
            rows: getNumber(dataSet, 'x00280010'),
            columns: getNumber(dataSet, 'x00280011'),
            bitsAllocated: getNumber(dataSet, 'x00280100'),
            numberOfFrames: getNumber(dataSet, 'x00280008') || 1, // Default to 1 if missing
        };
        
        // Minor cleanups for DICOM standard formatting (e.g. ^ used for spaces in names)
        if (metadata.patientName) {
            metadata.patientName = metadata.patientName.replace(/\^/g, ' ').trim();
        }

        return {
            success: true,
            metadata
        };
    } catch (error: any) {
        console.error('DICOM parsing error:', error);
        return {
            success: false,
            error: error?.message || 'File does not appear to be a valid DICOM file.'
        };
    }
}
