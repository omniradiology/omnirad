import { DicomStudy, DicomSeries, DicomInstance } from "@/types/pacs";
import { formatPatientName, formatDicomDate, formatDicomTime } from "./dicom-utils";

/**
 * Searches for studies using our Next.js API proxy
 */
export async function searchStudies(filters: Record<string, string>): Promise<DicomStudy[]> {
    const searchParams = new URLSearchParams(filters);
    searchParams.append('includefield', '00081030,00100030,00101010,00100040,00080061'); // Ensure StudyDescription, Age, Sex, Modalities are returned
    const res = await fetch(`/api/pacs/qido/studies?${searchParams.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    
    const data = await res.json();
    return data.map((item: any) => ({
        id: item["0020000D"]?.Value?.[0] || "",
        studyInstanceUid: item["0020000D"]?.Value?.[0] || "",
        patientName: formatPatientName(item["00100010"]?.Value?.[0]?.Alphabetic || item["00100010"]?.Value?.[0] || "Unknown"),
        patientId: item["00100020"]?.Value?.[0] || "Unknown",
        patientBirthDate: item["00100030"]?.Value?.[0] || "",
        patientAge: item["00101010"]?.Value?.[0] || "",
        patientSex: item["00100040"]?.Value?.[0] || "",
        studyDate: formatDicomDate(item["00080020"]?.Value?.[0]),
        studyTime: formatDicomTime(item["00080030"]?.Value?.[0]),
        accessionNumber: item["00080050"]?.Value?.[0] || "",
        studyDescription: item["00081030"]?.Value?.[0] || "No Description",
        modalitiesInStudy: item["00080061"]?.Value || [],
        numberOfStudyRelatedSeries: item["00201206"]?.Value?.[0] || 0,
        numberOfStudyRelatedInstances: item["00201208"]?.Value?.[0] || 0,
    }));
}

/**
 * Search series within a study
 */
export async function searchSeries(studyUid: string): Promise<DicomSeries[]> {
    const res = await fetch(`/api/pacs/qido/series?studyUid=${studyUid}&includefield=0008103E`); // Ensure SeriesDescription is returned
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    return data.map((item: any) => ({
        studyInstanceUid: studyUid,
        seriesInstanceUid: item["0020000E"]?.Value?.[0] || "",
        seriesNumber: item["00200011"]?.Value?.[0] || 0,
        modality: item["00080060"]?.Value?.[0] || "Unknown",
        seriesDescription: item["0008103E"]?.Value?.[0] || "No Description",
        numberOfSeriesRelatedInstances: item["00201209"]?.Value?.[0] || 0,
    }));
}

/**
 * Fetch a single instance Rendered JPEG as an object URL
 */
export async function fetchRenderedJpegUrl(studyUid: string, seriesUid: string, instanceUid: string, frame?: number): Promise<string> {
    let url = `/api/pacs/wado/render?studyUid=${studyUid}&seriesUid=${seriesUid}&instanceUid=${instanceUid}`;
    if (frame !== undefined) {
        url += `&frame=${frame}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch rendered image");
    
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

/**
 * Fetch study metadata
 */
export async function fetchStudyMetadata(studyUid: string): Promise<any> {
    const res = await fetch(`/api/pacs/metadata?studyUid=${studyUid}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
