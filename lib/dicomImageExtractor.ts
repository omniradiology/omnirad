import * as dicomParser from 'dicom-parser';

export async function extractUncompressedDicomFrame(file: File): Promise<string | null> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        
        const transferSyntax = dataSet.string('x00020010')?.trim() || '';
        
        // Uncompressed syntaxes (Implicit VR Little Endian, Explicit VR Little/Big Endian)
        const uncompressedSyntaxes = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2'];
        
        if (!uncompressedSyntaxes.includes(transferSyntax)) {
            // Not supported by this simple extractor. Will fall back to Cornerstone Viewer.
            return null;
        }

        const rows = dataSet.uint16('x00280010');
        const columns = dataSet.uint16('x00280011');
        const bitsAllocated = dataSet.uint16('x00280100');
        const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0=unsigned, 1=signed
        
        let windowCenter = dataSet.string('x00281050') ? parseFloat(dataSet.string('x00281050')!) : undefined;
        let windowWidth = dataSet.string('x00281051') ? parseFloat(dataSet.string('x00281051')!) : undefined;

        if (!rows || !columns || !bitsAllocated) return null;

        const pixelDataElement = dataSet.elements.x7fe00010;
        if (!pixelDataElement) return null;

        // Extract raw bytes
        const pixelBytes = byteArray.slice(pixelDataElement.dataOffset, pixelDataElement.dataOffset + pixelDataElement.length);
        
        let minPixel = Infinity;
        let maxPixel = -Infinity;
        const pixelValues = new Float32Array(rows * columns);

        if (bitsAllocated === 16) {
            const dataView = new DataView(pixelBytes.buffer, pixelBytes.byteOffset, pixelBytes.byteLength);
            for (let i = 0; i < rows * columns; i++) {
                let val = pixelRepresentation === 1 ? dataView.getInt16(i * 2, true) : dataView.getUint16(i * 2, true);
                pixelValues[i] = val;
                if (val < minPixel) minPixel = val;
                if (val > maxPixel) maxPixel = val;
            }
        } else if (bitsAllocated === 8) {
            for (let i = 0; i < rows * columns; i++) {
                let val = pixelBytes[i];
                pixelValues[i] = val;
                if (val < minPixel) minPixel = val;
                if (val > maxPixel) maxPixel = val;
            }
        } else {
            return null; // Unsupported bit depth
        }

        // Apply Window/Level if provided, otherwise auto-window to min/max
        if (windowCenter === undefined || windowWidth === undefined) {
            windowCenter = (maxPixel + minPixel) / 2;
            windowWidth = maxPixel - minPixel;
        }

        const lowerBound = windowCenter - 0.5 - (windowWidth - 1) / 2;
        const upperBound = windowCenter - 0.5 + (windowWidth - 1) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = columns;
        canvas.height = rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const imageData = ctx.createImageData(columns, rows);
        const data = imageData.data;

        for (let i = 0; i < pixelValues.length; i++) {
            let val = pixelValues[i];
            
            // Apply VOI LUT
            let luminance = 0;
            if (val <= lowerBound) {
                luminance = 0;
            } else if (val >= upperBound) {
                luminance = 255;
            } else {
                luminance = Math.floor(((val - windowCenter - 0.5) / (windowWidth - 1) + 0.5) * 255);
            }

            const offset = i * 4;
            data[offset]     = luminance; // R
            data[offset + 1] = luminance; // G
            data[offset + 2] = luminance; // B
            data[offset + 3] = 255;       // A
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.92);

    } catch (e) {
        console.error("Simple extractor failed:", e);
        return null;
    }
}
