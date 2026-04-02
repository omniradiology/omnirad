export interface PacsConfig {
  pacsOrthancUrl: string;
  pacsAuthType: 'none' | 'basic' | 'bearer';
  pacsUsername?: string;
  pacsPassword?: string;
  pacsBearerToken?: string;
  pacsAeTitle?: string;
}

export interface DicomStudy {
  id: string; // Internal identifier
  studyInstanceUid: string;
  patientName: string;
  patientId: string;
  patientBirthDate?: string;
  patientAge?: string;
  patientSex?: string;
  studyDate: string;
  studyTime: string;
  accessionNumber: string;
  studyDescription: string;
  modalitiesInStudy: string[];
  numberOfStudyRelatedSeries: number;
  numberOfStudyRelatedInstances: number;
}

export interface DicomSeries {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  seriesNumber: number;
  modality: string;
  seriesDescription: string;
  numberOfSeriesRelatedInstances: number;
}

export interface DicomInstance {
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  instanceNumber: number;
}
