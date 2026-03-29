
# DICOM Support Implementation Plan for OpenRad

## Overview & Guiding Architecture Philosophy

Before writing a single line of code, the developer needs to understand the fundamental split of concerns this feature introduces. There are two distinct pipelines that need to be built and then connected: the **rendering pipeline** (for the radiologist to visually interact with the image in the browser) and the **extraction pipeline** (for programmatically converting the DICOM pixel data into a JPEG and structured metadata to send to n8n). These pipelines share some underlying libraries but serve different purposes and should be architected as separate modules. Conflating them will create an unmaintainable mess.

The guiding constraint is that everything in this implementation must be **client-side only**. DICOM files contain highly sensitive PHI (Protected Health Information), and uploading them raw to any server other than the intended destination is a HIPAA/GDPR concern. All parsing, decoding, and JPEG extraction must happen in the browser before any data leaves the user's machine.

---

## Phase 0: Codebase Audit Before Starting

The developer should spend time understanding two specific things in the existing OpenRad codebase before touching anything.

First, locate the function or service that actually fires the HTTP request to the n8n webhook. Understand exactly what the current payload looks like — is it sending a raw `File` object via `FormData`, or is it converting the image to a base64 string first? This matters enormously because the DICOM pipeline will need to slot into this exact point, and the developer must not break the existing standard image workflow. The webhook call is likely somewhere in the `lib/` or `app/` directory, possibly triggered by a form submission handler.

Second, audit the current file upload UI component to understand the current state flow. When a user selects a file today, what state variables are updated? Where does the preview image get stored? Understanding this prevents the DICOM file path and the standard image file path from colliding in the same state.

---

## Phase 1: Dependency Installation & Next.js Configuration

Install the following npm packages: `dicom-parser`, `@cornerstonejs/core`, `@cornerstonejs/tools`, and `@cornerstonejs/dicom-image-loader`. The `dicom-parser` library is a standalone, lightweight parser that has no external dependencies and handles the binary DICOM format. The Cornerstone3D libraries handle the WebGL-based interactive rendering.

The Next.js configuration in `next.config.ts` needs to be updated to handle WebAssembly, because Cornerstone3D ships WASM codec files for decoding compressed DICOM transfer syntaxes. In the webpack config, enable `experiments.asyncWebAssembly = true`. Additionally, Cornerstone3D uses Web Workers internally, so `experiments.layers = true` may also be needed. The developer should also add a rule to handle `.wasm` files as assets. This webpack configuration step is non-negotiable — without it, the app will throw cryptic module resolution errors when Cornerstone tries to load its codec WASM modules.

A critical Next.js-specific pitfall: all Cornerstone3D components and any code that imports from `@cornerstonejs/core` must be imported using `next/dynamic` with `{ ssr: false }`. These libraries directly reference `window`, `document`, and WebGL contexts, which do not exist in Node.js during server-side rendering. Any attempt to import them at the top level of a server component or a non-dynamic client component will cause the build to fail. Every file that touches Cornerstone must be treated as a browser-only module.

---

## Phase 2: Define TypeScript Types First

Before building any logic, define the data shapes in the `types/` directory. Create a `dicom.ts` type file that defines a `DicomMetadata` interface containing fields for patient name, patient ID, patient date of birth, patient sex, study date, study time, modality, institution name, study description, series description, body part examined, referring physician name, accession number, transfer syntax UID, rows, columns, number of frames, and bits allocated. Also define a `DicomExtractionResult` interface that combines the metadata with an array of extracted frame images (as base64 JPEG strings or `Blob` objects), a boolean indicating whether the file was successfully parsed, and an optional error message.

Having these types defined upfront ensures the three phases of the pipeline (parsing, rendering, extraction) all speak the same language and forces the developer to think through edge cases before implementing them.

---

## Phase 3: Build the DICOM Metadata Parser (`lib/dicomMetadataParser.ts`)

This module is the simplest and most reliable piece of the entire feature. It takes a `File` object as input, reads it as an `ArrayBuffer`, and passes the bytes to `dicom-parser`'s `parseDicom()` function. The result is a `DataSet` object from which you can extract tag values using a simple string-keyed API.

The developer should extract the following DICOM tags at minimum and map them to the `DicomMetadata` type: patient name (`x00100010`), patient ID (`x00100020`), patient birth date (`x00100030`), patient sex (`x00100040`), modality (`x00080060`), study date (`x00080020`), institution name (`x00080080`), study description (`x00081030`), series description (`x0008103e`), body part examined (`x00180015`), rows (`x00280010`), columns (`x00280011`), bits allocated (`x00280100`), number of frames (`x00280008`), and transfer syntax UID (`x00020010`). The transfer syntax UID is especially important — it tells you how the pixel data is compressed, which determines the extraction strategy in the next phase.

This parser should be wrapped in a `try/catch` because `dicom-parser` throws synchronously on corrupted or non-DICOM files. The error should be caught, logged, and returned as part of the `DicomExtractionResult` with a meaningful message like "File does not appear to be a valid DICOM file" rather than crashing the application. Wrap the entire function in an `async` wrapper that uses a `FileReader` to read the file as an `ArrayBuffer` before parsing, since the browser file reading API is asynchronous.

---

## Phase 4: Build the DICOM Image Extractor (`lib/dicomImageExtractor.ts`)

This is the most technically complex module in the entire implementation, and it is the one most likely to cause problems. Its job is to take pixel data from the parsed DICOM `DataSet` and produce one or more JPEG images suitable for sending to n8n.

The developer must handle different transfer syntaxes differently. There are three major categories to address in v1.

The first and most common case for real-world deployment is **uncompressed pixel data** (transfer syntaxes `1.2.840.10008.1.2`, `1.2.840.10008.1.2.1`, and `1.2.840.10008.1.2.2`). Here, `dicom-parser` can directly provide the raw pixel value array via `dataset.byteArray` at the pixel data tag offset. The developer reads these values, applies a windowing transform (mapping the raw Hounsfield Units or grayscale values to the visible 0–255 range using the `WindowCenter` and `WindowWidth` DICOM tags, or computing a min/max window from the pixel data itself as a fallback), paints the result into a hidden offscreen `<canvas>` element using `ImageData`, and then calls `canvas.toDataURL('image/jpeg', 0.92)` to produce the base64 JPEG string.

The second case is **JPEG-compressed pixel data** (transfer syntax `1.2.840.10008.1.2.4.50`). In this case, the pixel data in the DICOM file is already a standard JPEG bitstream. The developer can extract the encapsulated pixel data fragment directly as a byte array and create a `Blob` of type `image/jpeg` from it, then use `URL.createObjectURL` to display it, or convert it to base64 via a `FileReader`. This is actually simpler than the uncompressed case.

The third case is **JPEG 2000 and JPEG-LS** (transfer syntaxes `1.2.840.10008.1.2.4.90`, `1.2.840.10008.1.2.4.91`, `1.2.840.10008.1.2.4.80`, `1.2.840.10008.1.2.4.81`). These require a dedicated codec decoder and are significantly more complex. For v1, the recommended approach is to fall back to using Cornerstone3D's rendering pipeline to handle these — let Cornerstone decode and render the image into its WebGL viewport, then capture the viewport canvas using `canvas.toDataURL()`. This is less efficient but eliminates the need to implement a standalone JPEG 2000 decoder. Document this clearly as a known limitation: JPEG 2000 extraction quality depends on Cornerstone's viewport rendering rather than direct pixel data access.

For **multi-frame DICOM** (CT stacks, MRI series, cine ultrasound), the extractor should not attempt to extract all frames at once for large studies — a 512×512×500 CT scan at 16-bit depth is hundreds of megabytes of pixel data. Instead, the extractor should accept a `frameIndex` parameter and extract only one frame at a time. The calling code is then responsible for deciding which frames to request.

---

## Phase 5: Build the DicomViewer React Component (`components/DicomViewer.tsx`)

This component is the interactive viewer for the radiologist. It must be a pure client component imported with `next/dynamic` and `ssr: false` from the parent component.

On component mount, initialize a Cornerstone3D rendering engine with a unique ID (use a `useRef` with a UUID or a timestamp to avoid collision if multiple viewers ever exist). Create a `STACK_VIEWPORT` on a `<div>` element with a fixed aspect ratio. Load the DICOM image using the `wadouri:` image ID scheme combined with `URL.createObjectURL(file)` to create a temporary browser URL for the local file. Call `viewport.loadImage(imageId)` to render it.

The component should expose the following interactive tools via the Cornerstone3D Tools library: `WindowLevelTool` bound to left mouse drag (the primary interaction for adjusting brightness/contrast), `ZoomTool` bound to right mouse drag or a toolbar button, `PanTool` bound to middle mouse drag, and a reset button that calls `viewport.resetCamera()` and `viewport.resetProperties()`. For multi-frame files, expose a frame slider that calls `viewport.setImageIdIndex(index)` and displays the current frame number and total frames.

The component should also expose a `captureFrame()` method via a `useImperativeHandle` ref that retrieves the underlying canvas element from the rendering engine and returns its current content as a JPEG base64 string. This is how the parent component will grab the "what the radiologist is currently seeing" for inclusion in the n8n payload. Make sure the cleanup `useEffect` destroys the rendering engine, revokes any `URL.createObjectURL` URLs, and resets the Cornerstone3D tool group to prevent memory leaks between file uploads.

---

## Phase 6: Update the File Upload Component

The existing upload `<input>` element should have its `accept` attribute changed from `image/*` to `image/*,.dcm,.dicom` to allow both file types. The `onChange` handler needs to be expanded into a proper file detection and routing function.

When a file is selected, the handler should first check the file extension (`.dcm`, `.dicom`) or attempt to read the first four bytes of the file as a magic byte check. DICOM files have the string `DICM` at byte offset 128 in the file preamble. If this magic sequence is found, the file is confidently DICOM. If not, fall back to the existing standard image preview path. Using the extension alone as a detection mechanism is unreliable because users frequently rename files.

If the file is detected as DICOM, the handler should: set a `isDicomProcessing` loading state to `true`, call the metadata parser asynchronously, update the form fields with the extracted metadata (patient name, modality, study date etc.), initialize the DicomViewer component by passing the file to it, set `isDicomProcessing` to `false`, and store the extracted metadata and file reference in the component's state for later use when constructing the n8n payload.

Auto-populating form fields from DICOM metadata should use a one-time "fill empty fields" strategy rather than forcibly overwriting whatever the user has already typed. If the patient name field already contains text, don't overwrite it. If it's empty, fill it from the DICOM tag. This respects user intent and prevents frustrating overwrites if someone has manually corrected a discrepancy.

Show a visible UI indicator (a small badge or pill) next to auto-populated fields saying "Auto-filled from DICOM" so the radiologist knows which values came from the file versus which they entered manually. This is important for medical accuracy awareness.

---

## Phase 7: Redesign the n8n Webhook Payload

Currently the webhook likely receives image bytes and a few form fields. The new payload needs to be richer and backward-compatible. Design the payload as a JSON object with a discriminated union structure based on an `imageSource` field.

When the image source is DICOM, the payload should include: the JPEG image as a base64 string (extracted from the current viewport frame), the `DicomMetadata` object as a nested JSON property, the frame index and total frame count for multi-frame files, the modality code, and a flag `isDicom: true`. When the image source is a standard image, the payload should include the image as base64 and `isDicom: false`, exactly as it does today.

The `multipart/form-data` approach may need to be changed to a pure JSON body for DICOM submissions, because the metadata object is structured and doesn't fit cleanly into flat form fields. Coordinate this change with the n8n workflow configuration — the n8n HTTP request node receiving the webhook will need to be updated to parse the richer JSON body and extract the image data and metadata fields separately. The n8n workflow documentation in the README references the existing workflow, so the developer should document the new expected payload schema for whoever maintains the n8n side.

For multi-frame DICOM files (CT, MRI), decide on a frame selection strategy before implementation. The recommended approach for v1 is: send the single frame currently displayed in the DicomViewer at the time the user clicks "Generate Report." This gives the radiologist full control over which representative slice the AI analyzes. A v2 enhancement could allow selecting and sending multiple key frames simultaneously.

---

## Phase 8: State Management Updates

The existing app uses React Context and hooks. The DICOM workflow introduces several new state concerns that should be added to the relevant context provider or a new dedicated `DicomContext`.

New state to track includes: the raw DICOM `File` object, the parsed `DicomMetadata` result, the current frame index for multi-frame files, the total frame count, the processing/loading state of the DICOM pipeline, the extracted JPEG base64 string for the current viewport frame, and any error encountered during parsing. A ref should hold the `DicomViewer` component's imperative handle so that the "Generate Report" button can call `captureFrame()` on it just before firing the n8n webhook.

Keep the DICOM state isolated from the standard image state. Introduce a top-level `uploadMode` state variable that is either `'standard'` or `'dicom'` to make the conditional rendering logic clean and predictable throughout the component tree.

---

## Phase 9: Error Handling & Edge Cases to Design For

The developer should explicitly handle the following scenarios and show appropriate user-facing messages in each case.

An invalid or corrupted DICOM file should show a clear error message with a suggestion to verify the file. A DICOM file with no pixel data (a KOS or SR document rather than an image) should inform the user that the file does not contain images. Transfer syntaxes not supported by the current extraction implementation should display a message specifying the limitation and suggesting the user convert the file to uncompressed format using tools like dcmtk. DICOM files larger than a configurable threshold (e.g., 50MB) should prompt the user with a warning that processing may be slow. WebGL unavailability (Cornerstone3D requires WebGL 2) should degrade gracefully by disabling the interactive viewer and still attempting metadata extraction and JPEG extraction via the canvas path.

Memory management deserves special attention. DICOM pixel data arrays can be very large. After the extraction is complete and the JPEG has been captured, the raw pixel data array reference should be explicitly released. Any `URL.createObjectURL` URLs must be revoked with `URL.revokeObjectURL()` when the component unmounts or when a new file is loaded. The Cornerstone3D rendering engine must be destroyed on unmount. These are not optional cleanup tasks — without them, the browser tab will accumulate memory with each file loaded and eventually crash, which is unacceptable in a clinical environment where a radiologist might review dozens of studies in a session.

---

## Phase 10: Testing Resources & Strategy

There is no need to use real patient data for testing. The developer should source test DICOM files from **OsiriX's free sample DICOM library** and **The Cancer Imaging Archive (TCIA)** at `cancerimagingarchive.net`, both of which provide de-identified DICOM files for development purposes. Test against at minimum: a single-frame chest X-ray CR file (uncompressed), a multi-frame CT series, an MRI study, an ultrasound with JPEG-compressed pixel data, and if possible a PET scan or mammogram to stress-test unusual modality handling.

The test matrix should explicitly verify that metadata auto-population works correctly, that the extracted JPEG looks visually correct (proper windowing applied, no inverted grays), that the n8n webhook receives the payload and the n8n workflow can parse it, that memory usage does not grow after repeated file loads, and that the existing standard image upload path still works exactly as before without any regression.

---

## Recommended Build Order

The developer should build these phases in strict dependency order to allow incremental testing at each step. Start with Phase 0 (audit) and Phase 2 (types) since these require no new libraries. Then Phase 1 (dependencies + webpack config) because everything else depends on correct build configuration. Then Phase 3 (metadata parser) since it's self-contained and can be tested in isolation with `console.log`. Then Phase 4 (image extractor) for uncompressed transfer syntax only first, and verify JPEG output quality before moving on. Then Phase 5 (DicomViewer) so the developer can see the image visually and compare it against the extracted JPEG for correctness. Then Phase 6 (updated upload), Phase 8 (state management), and Phase 7 (n8n payload) together as they are tightly coupled. Finally Phase 9 (error handling) as a polish pass after the happy path is working.

The JPEG 2000 fallback path in Phase 4 should be the very last thing implemented, as it depends on Cornerstone3D being fully working first.