// ─── Coordinate Mapper ───────────────────────────────────────────────────────
// Maps between MedSAM3 pixel-space coordinates and the Cornerstone viewport.
// First implementation uses image pixel space which is sufficient for stack viewports.

export interface ImageDimensions {
    width: number;
    height: number;
}

/**
 * Convert image pixel coordinates to viewport coordinates.
 * For stack viewports with standard 2D slice rendering, image-space
 * coordinates map 1:1 with Cornerstone image coordinates.
 */
export function imageToViewportCoordinates(
    imageX: number,
    imageY: number,
    imageDims: ImageDimensions,
    viewportDims: ImageDimensions
): { x: number; y: number } {
    const scaleX = viewportDims.width / imageDims.width;
    const scaleY = viewportDims.height / imageDims.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (viewportDims.width - imageDims.width * scale) / 2;
    const offsetY = (viewportDims.height - imageDims.height * scale) / 2;

    return {
        x: imageX * scale + offsetX,
        y: imageY * scale + offsetY,
    };
}

/**
 * Convert viewport coordinates back to image pixel coordinates.
 */
export function viewportToImageCoordinates(
    viewportX: number,
    viewportY: number,
    imageDims: ImageDimensions,
    viewportDims: ImageDimensions
): { x: number; y: number } {
    const scaleX = viewportDims.width / imageDims.width;
    const scaleY = viewportDims.height / imageDims.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (viewportDims.width - imageDims.width * scale) / 2;
    const offsetY = (viewportDims.height - imageDims.height * scale) / 2;

    return {
        x: (viewportX - offsetX) / scale,
        y: (viewportY - offsetY) / scale,
    };
}

/**
 * Convert percentage-based coordinates (0-1 range) to pixel coordinates.
 * Useful when an upstream vision model returns normalized bounding boxes.
 */
export function percentToPixelCoordinates(
    percentX: number,
    percentY: number,
    imageDims: ImageDimensions
): { x: number; y: number } {
    return {
        x: percentX * imageDims.width,
        y: percentY * imageDims.height,
    };
}

/**
 * Convert a percentage-based bounding box to pixel bbox.
 */
export function percentBboxToPixelBbox(
    bbox: [number, number, number, number],
    imageDims: ImageDimensions
): [number, number, number, number] {
    return [
        bbox[0] * imageDims.width,
        bbox[1] * imageDims.height,
        bbox[2] * imageDims.width,
        bbox[3] * imageDims.height,
    ];
}
