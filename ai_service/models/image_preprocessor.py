"""
OmniRad — Medical Image Preprocessor

Preprocessing utilities for medical images before segmentation inference.
Handles DICOM-specific transforms, base64 decoding, and normalization.
"""

import base64
import io
import re
from typing import Optional, Tuple

import numpy as np
from PIL import Image


def decode_base64_image(data_url: str) -> np.ndarray:
    """Decode a base64 data URL or raw base64 string to a numpy RGB array."""
    # Strip data URI prefix if present
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def encode_image_to_base64(image: np.ndarray, fmt: str = "PNG") -> str:
    """Encode a numpy image array to a base64 data URL."""
    img = Image.fromarray(image.astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/{fmt.lower()};base64,{b64}"


def apply_rescale(pixel_array: np.ndarray, slope: float = 1.0, intercept: float = 0.0) -> np.ndarray:
    """Apply DICOM rescale slope and intercept: HU = pixel * slope + intercept."""
    return pixel_array.astype(np.float64) * slope + intercept


def apply_windowing(
    image: np.ndarray,
    window_center: float,
    window_width: float,
) -> np.ndarray:
    """Apply DICOM window center/width for display normalization."""
    min_val = window_center - window_width / 2
    max_val = window_center + window_width / 2
    clipped = np.clip(image, min_val, max_val)
    normalized = (clipped - min_val) / (max_val - min_val)
    return (normalized * 255).astype(np.uint8)


def apply_monochrome1_inversion(image: np.ndarray) -> np.ndarray:
    """Invert pixel values for MONOCHROME1 photometric interpretation."""
    if image.dtype == np.uint8:
        return 255 - image
    max_val = image.max()
    return max_val - image


def normalize_to_uint8(image: np.ndarray) -> np.ndarray:
    """Normalize any numeric array to uint8 [0, 255] range."""
    arr = image.astype(np.float64)
    min_val = arr.min()
    max_val = arr.max()
    if max_val - min_val == 0:
        return np.zeros_like(arr, dtype=np.uint8)
    normalized = (arr - min_val) / (max_val - min_val)
    return (normalized * 255).astype(np.uint8)


def preprocess_medical_image(
    image: np.ndarray,
    slope: Optional[float] = None,
    intercept: Optional[float] = None,
    window_center: Optional[float] = None,
    window_width: Optional[float] = None,
    photometric: Optional[str] = None,
) -> np.ndarray:
    """Full preprocessing pipeline for a medical image before segmentation.
    
    Steps:
    1. Apply rescale slope/intercept (if DICOM metadata provided)
    2. Apply windowing (if window center/width provided)
    3. Invert if MONOCHROME1
    4. Normalize to uint8
    """
    result = image.copy()
    
    # Step 1: Rescale
    if slope is not None and intercept is not None:
        result = apply_rescale(result, slope, intercept)
    
    # Step 2: Windowing
    if window_center is not None and window_width is not None:
        result = apply_windowing(result, window_center, window_width)
    
    # Step 3: MONOCHROME1 inversion
    if photometric and "MONOCHROME1" in photometric.upper():
        result = apply_monochrome1_inversion(result)
    
    # Step 4: Normalize to uint8
    result = normalize_to_uint8(result)
    
    # Ensure RGB (3 channels)
    if result.ndim == 2:
        result = np.stack([result, result, result], axis=-1)
    elif result.ndim == 3 and result.shape[2] == 1:
        result = np.concatenate([result, result, result], axis=-1)
    
    return result


def resize_for_inference(image: np.ndarray, target_size: int = 1024) -> Tuple[np.ndarray, float]:
    """Resize image to fit within target_size while maintaining aspect ratio.
    
    Returns:
        Tuple of (resized_image, scale_factor)
    """
    h, w = image.shape[:2]
    scale = target_size / max(h, w)
    
    if scale >= 1.0:
        return image, 1.0
    
    new_h = int(h * scale)
    new_w = int(w * scale)
    
    img = Image.fromarray(image)
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    return np.array(resized), scale
