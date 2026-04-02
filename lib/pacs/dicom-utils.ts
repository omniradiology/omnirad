/**
 * Parses and formats a DICOM Patient Name (PN) VR.
 * Usually in the format: "FamilyName^GivenName^MiddleName^NamePrefix^NameSuffix"
 * DICOMweb json may already extract it as { Alphabetic: "DOE^JOHN" }
 */
export function formatPatientName(pnString: string | any): string {
    if (!pnString) return "Unknown";
    let raw = "";

    if (typeof pnString === "string") {
        raw = pnString;
    } else if (pnString.Alphabetic) {
        raw = pnString.Alphabetic;
    } else {
        return "Unknown";
    }

    // Replace carets with spaces, keeping names proper-cased roughly
    const parts = raw.split("^").map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return "Unknown";

    // Usually family name is first in DICOM, given name second. 
    // Example: DOE^JOHN => JOHN DOE
    if (parts.length >= 2) {
        return `${parts[1]} ${parts[0]}`.replace(/\b\w/g, l => l.toUpperCase());
    }

    // If only one part or unusual formatting
    return parts[0].replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Formats a DICOM Date (DA) VR.
 * Format is typically "YYYYMMDD".
 */
export function formatDicomDate(daString?: string): string {
    if (!daString || daString.length !== 8) return daString || "Unknown Date";
    const year = daString.slice(0, 4);
    const month = daString.slice(4, 6);
    const day = daString.slice(6, 8);
    return `${year}-${month}-${day}`;
}

/**
 * Formats a DICOM Time (TM) VR.
 * Format is typically "HHMMSS.FFFFFF" or "HHMMSS".
 */
export function formatDicomTime(tmString?: string): string {
    if (!tmString || tmString.length < 6) return tmString || "Unknown Time";
    const hours = tmString.slice(0, 2);
    const minutes = tmString.slice(2, 4);
    const seconds = tmString.slice(4, 6);
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Parses a DICOM Age String (AS).
 * Format is e.g., "045Y", "006M", "014D".
 */
export function parseDicomAge(asString?: string): number | null {
    if (!asString) return null;
    const match = asString.match(/^(\d{3})([YMWD])$/);
    if (!match) return null;
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    if (unit === 'Y') return value;
    if (unit === 'M') return Math.floor(value / 12); // Approximate years from months
    
    return 0; // Infant/Days
}
