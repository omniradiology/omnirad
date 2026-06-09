import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { reports, worklistOrders } from "../db/schema";
import { Patient, ReportData } from "./index";

export type ReportRow = InferSelectModel<typeof reports>;
export type WorklistOrder = InferSelectModel<typeof worklistOrders>;
export type OmniRadWorklistOrderInput = InferInsertModel<typeof worklistOrders>;

export interface DiagnosticReportInput {
    report: ReportRow;
    reportData: ReportData;
    patient?: Patient;
    pdfBase64?: string;
    serviceRequestId?: string;
}

export interface ImagingStudyInput {
    report: ReportRow;
    reportData: ReportData;
    patient?: Patient;
}
