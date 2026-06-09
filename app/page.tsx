"use client"

import * as React from "react"
import { PatientForm } from "@/components/dashboard/PatientForm";
import { StudyPlaceholder } from "@/components/dashboard/StudyPlaceholder";
import { ReportView } from "@/components/dashboard/ReportView";
import { ImageViewer } from "@/components/dashboard/ImageViewer";
import { generateReport } from "@/lib/api";
import { PatientContext, ReportData } from "@/types";

export default function Home() {
  const [report, setReport] = React.useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [patientImages, setPatientImages] = React.useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (patientImages && patientImages.length > 0) {
      const urls = patientImages.map(img => URL.createObjectURL(img));
      setImagePreviews(urls);
      return () => urls.forEach(url => URL.revokeObjectURL(url));
    }
    // We intentionally don't clear imagePreviews in an else block here,
    // so that manual DICOM base64 previews don't get wiped out.
  }, [patientImages]);

  const handleGenerate = async (data: PatientContext, dicomRef?: React.RefObject<any>) => {
    setIsGenerating(true);
    try {
      // No longer need to check for n8n webhook since we use the local Python backend


      let dicomBase64: string | null = null;
      let dicomSlices: string[] = [];
      if (data.isDicom && dicomRef?.current) {
          try {
              const totalFrames = dicomRef.current.getTotalFrames?.() || 1;
              if (totalFrames > 1) {
                  // Multi-slice study: capture ALL slices
                  dicomSlices = await dicomRef.current.captureMultipleFrames(totalFrames);
                  dicomBase64 = dicomSlices[0] || null;
                  console.log(`[OmniRad] Captured all ${dicomSlices.length} slices from ${totalFrames} total frames`);
              } else {
                  // Single frame
                  dicomBase64 = await dicomRef.current.captureFrame();
                  if (dicomBase64) dicomSlices = [dicomBase64];
              }
          } catch (e) {
              console.error("Failed to capture DICOM frame(s) for upload", e);
          }
      }

      // For DICOM: use the captured JPEG base64 as the preview
      // For manual: use object URLs from the uploaded image files
      if (data.isDicom && dicomSlices.length > 0) {
        setImagePreviews(dicomSlices);
        setPatientImages([]); // Don't store raw .dcm in patientImages
      } else {
        const files = data.images || (data.image ? [data.image] : []);
        setPatientImages(files);
      }

      const reports = await generateReport(data, dicomBase64, dicomSlices);
      if (reports && reports.length > 0) {
        setReport(reports[0]);
        // Fast-track syncing image previews from the API result (crucial for PACS imports)
        if (data.isPacs) {
            if (reports[0].images_data && reports[0].images_data.length > 0) {
                setImagePreviews(reports[0].images_data);
            } else if (reports[0].image_data) {
                setImagePreviews([reports[0].image_data]);
            }
        }
      }
    } catch (error) {
      console.error("Failed to generate report", error);
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to generate report: ${errMsg}. Please check your Python AI Service and try again.`);
    } finally {
      setIsGenerating(false);
    }
  }

  const handleNewPatient = () => {
    setReport(null);
    setPatientImages([]);
    setImagePreviews([]);
  }

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Left Panel - Patient Entry OR Image Viewer */}
      <div className={`w-full md:w-[450px] md:min-w-[450px] h-auto md:h-full border-b md:border-b-0 md:border-r border-border-primary bg-bg-primary overflow-hidden transition-all duration-300`}>
        {report ? (
          <ImageViewer
            imageSrc={imagePreviews.length > 0 ? imagePreviews[0] : (process.env.NODE_ENV === 'development' ? "/placeholder-xray.png" : null)}
            images={imagePreviews.length > 0 ? imagePreviews : (process.env.NODE_ENV === 'development' ? ["/placeholder-xray.png"] : [])}
            className="w-full h-full"
            isCollapsed={false}
            onToggleCollapse={() => { }} // Not needed in this layout for now
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <PatientForm onSubmit={handleGenerate} isGenerating={isGenerating} />
          </div>
        )}
      </div>

      {/* Right Panel - Viewer/Report Area */}
      <div className={`flex-1 h-full bg-bg-primary p-4 overflow-hidden`}>
        {report ? (
          <ReportView
            report={report}
            onNewPatient={handleNewPatient}
            imagePreview={imagePreviews.length > 0 ? imagePreviews[0] : null}
            imagesPreviews={imagePreviews}
            reportId={report.report_header.report_id}
          />
        ) : (
          <StudyPlaceholder />
        )}
      </div>
    </div>
  );
}
