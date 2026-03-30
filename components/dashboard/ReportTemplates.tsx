import * as React from "react";
import { ReportData } from "@/types";
import { CheckCircle, XCircle } from "lucide-react";

interface ReportTemplateProps {
    report: ReportData;
}

/**
 * PDF-Optimized Standard Template
 * 
 * This component uses a strict legacy HTML/CSS approach (Tables, inline styles) 
 * to ensure 100% compatibility with html2pdf.js / html2canvas.
 * It avoids CSS Grid, Flexbox, and modern CSS variables.
 */
export const PdfStandardTemplate: React.FC<ReportTemplateProps> = ({ report }) => {
    // Helper for safe styles
    const styles = {
        container: {
            width: '210mm',
            minHeight: '297mm',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            lineHeight: '1.5',
            padding: '40px',
            boxSizing: 'border-box' as const,
            position: 'relative' as const
        },
        headerTable: {
            width: '100%',
            marginBottom: '20px',
            borderBottom: '4px solid #333333',
            paddingBottom: '20px'
        },
        title: {
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#333333',
            marginBottom: '4px',
            textTransform: 'uppercase' as const
        },
        subtitle: {
            fontSize: '14px',
            color: '#666666',
            fontStyle: 'italic'
        },
        infoLabel: {
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#888888',
            textTransform: 'uppercase' as const
        },
        infoValue: {
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333333'
        },
        sectionHeader: {
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase' as const,
            color: '#555555',
            borderBottom: '1px solid #cccccc',
            paddingBottom: '4px',
            marginTop: '20px',
            marginBottom: '10px'
        },
        detailsTable: {
            width: '100%',
            borderCollapse: 'collapse' as const,
            marginBottom: '20px',
            border: '1px solid #eeeeee'
        },
        detailsCell: {
            padding: '8px',
            border: '1px solid #eeeeee',
            verticalAlign: 'top'
        },
        detailsLabel: {
            fontWeight: 'bold',
            color: '#555555',
            width: '120px'
        },
        findingRow: {
            marginBottom: '15px',
            pageBreakInside: 'avoid' as const
        },
        findingRegion: {
            fontWeight: 'bold',
            fontSize: '13px',
            borderBottom: '1px solid #eeeeee',
            display: 'inline-block',
            marginBottom: '4px'
        },
        tag: {
            display: 'inline-block',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '4px',
            marginLeft: '10px',
            verticalAlign: 'middle'
        }
    };

    return (
        <div id="report-pdf-standard" style={styles.container}>
            {/* Header */}
            <table style={styles.headerTable}>
                <tbody>
                    <tr>
                        <td style={{ verticalAlign: 'top' }}>
                            <div style={styles.title}>{report.report_header.hospital_name}</div>
                            <div style={styles.subtitle}>{report.report_header.department}</div>
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                            <div style={styles.infoLabel}>Report ID</div>
                            <div style={styles.infoValue}>{report.report_header.report_id}</div>
                            <div style={{ ...styles.infoLabel, marginTop: '8px' }}>Date</div>
                            <div style={{ fontSize: '12px', color: '#666666' }}>
                                {new Date(report.report_header.report_date).toLocaleString()}
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Patient & Exam Details */}
            <table style={styles.detailsTable}>
                <tbody>
                    <tr>
                        <td style={{ ...styles.detailsCell, width: '50%', backgroundColor: '#f9f9f9' }}>
                            <table style={{ width: '100%' }}>
                                <tbody>
                                    <tr>
                                        <td style={styles.detailsLabel}>Patient Name:</td>
                                        <td style={{ fontWeight: 'bold' }}>{report.patient.name}</td>
                                    </tr>
                                    {report.patient.patient_id && (
                                    <tr>
                                        <td style={styles.detailsLabel}>Patient ID:</td>
                                        <td>{report.patient.patient_id}</td>
                                    </tr>
                                    )}
                                    <tr>
                                        <td style={styles.detailsLabel}>Age / Gender:</td>
                                        <td>{report.patient.age} / {report.patient.gender}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                        <td style={{ ...styles.detailsCell, width: '50%', backgroundColor: '#ffffff' }}>
                            <table style={{ width: '100%' }}>
                                <tbody>
                                    <tr>
                                        <td style={styles.detailsLabel}>Modality:</td>
                                        <td>{report.study.modality}</td>
                                    </tr>
                                    <tr>
                                        <td style={styles.detailsLabel}>Exam:</td>
                                        <td>{report.study.examination}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Clinical History */}
            <div style={styles.sectionHeader}>Clinical History</div>
            <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '5px' }}>{report.clinical_information.history}</div>
                <div><span style={{ fontWeight: 'bold' }}>Indication: </span>{report.clinical_information.indication}</div>
            </div>

            {/* Findings */}
            <div style={styles.sectionHeader}>Findings</div>
            <div style={{ marginBottom: '20px' }}>
                {report.findings.map((finding, idx) => {
                    const status = finding.status?.toLowerCase() || 'normal';
                    let tagStyle = { ...styles.tag, backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #166534' }; // Green
                    let label = 'NORMAL';

                    if (status === 'abnormal') {
                        tagStyle = { ...styles.tag, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #991b1b' }; // Red
                        label = 'ABNORMAL';
                    } else if (status === 'indeterminate') {
                        tagStyle = { ...styles.tag, backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #854d0e' }; // Yellow
                        label = 'INDETERMINATE';
                    } else if (status.includes('post')) {
                        tagStyle = { ...styles.tag, backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #1e40af' }; // Blue
                        label = 'POST-PROCEDURAL';
                    }

                    return (
                        <div key={idx} style={styles.findingRow}>
                            <div>
                                <span style={styles.findingRegion}>{finding.anatomical_region}</span>
                                <span style={tagStyle}>{label}</span>
                            </div>
                            <div style={{ marginTop: '5px', paddingLeft: '5px' }}>
                                {finding.observation}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Impression */}
            <div style={styles.sectionHeader}>Impression</div>
            <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderLeft: '4px solid #333333', marginBottom: '30px' }}>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {report.impression.map((imp, idx) => (
                        <li key={idx} style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>{imp}</li>
                    ))}
                </ul>
                <div style={{ marginTop: '15px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 'bold' }}>Urgency: </span>
                    <span style={{ fontWeight: 'bold', color: report.urgency === 'Critical' ? 'red' : 'green' }}>{report.urgency}</span>
                </div>
            </div>

            {/* Footer / Signatures */}
            <div style={{ marginTop: 'auto', borderTop: '2px solid #333333', paddingTop: '20px' }}>
                <table style={{ width: '100%' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '60%', verticalAlign: 'bottom' }}>
                                <div style={{ fontSize: '10px', color: '#666666', marginBottom: '4px' }}>Prepared by:</div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{report.report_footer.prepared_by}</div>
                                <div style={{ fontSize: '11px', color: '#666666' }}>{report.report_footer.department}</div>
                            </td>
                            {report.report_footer.report_status === 'Approved' && (
                                <td style={{ width: '40%', textAlign: 'right', verticalAlign: 'bottom' }}>
                                    {report.report_footer.signature && (
                                        <img src={report.report_footer.signature} style={{ height: '50px', marginBottom: '5px', display: 'inline-block' }} alt="Sig" />
                                    )}
                                    <div style={{ fontSize: '10px', color: '#666666', marginBottom: '4px', borderTop: '1px solid #999', paddingTop: '4px', display: 'inline-block', width: '200px' }}>
                                        Electronically Approved by<br />
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>{report.report_footer.approved_by}</span>
                                    </div>
                                </td>
                            )}
                        </tr>
                    </tbody>
                </table>
                <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '9px', color: '#999999' }}>
                    {report.disclaimer}
                </div>
            </div>
        </div>
    );
};

export const StandardTemplate: React.FC<ReportTemplateProps> = ({ report }) => {
    // Keep existing StandardTemplate for web view to ensure it looks good on screen
    const urgencyColor = report.urgency === 'Critical' ? '#dc2626' :
        report.urgency === 'Urgent' ? '#ea580c' : '#16a34a';

    return (
        <div className="max-w-4xl mx-auto bg-white shadow-lg min-h-full border border-gray-200 html2pdf__page-break" id="report-full-content-standard">
            {/* 1. Header Section */}
            <div className="p-10 pb-6 border-b-2 border-gray-800">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-serif font-bold text-gray-900 tracking-tight uppercase mb-1">
                            {report.report_header.hospital_name}
                        </h1>
                        <p className="text-gray-600 font-medium text-lg font-serif italic">
                            {report.report_header.department}
                        </p>
                    </div>
                    <div className="text-right text-sm text-gray-500 font-medium">
                        <p><span className="font-bold text-gray-700">Report ID:</span> {report.report_header.report_id}</p>
                        <p><span className="font-bold text-gray-700">Date:</span> {new Date(report.report_header.report_date).toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* 2. Patient & Study Details Box */}
            <div className="px-10 py-8">
                <div className="flex border border-gray-200 rounded-sm overflow-hidden">
                    {/* Left Column: Patient */}
                    <div className="w-1/2 bg-gray-50 p-4 border-r border-gray-200">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr>
                                    <td className="font-bold w-[110px] pb-2 align-top" style={{ color: '#374151' }}>Patient Name:</td>
                                    <td className="font-bold uppercase pb-2 align-top" style={{ color: '#111827' }}>{report.patient.name}</td>
                                </tr>
                                {report.patient.patient_id && (
                                <tr>
                                    <td className="font-bold pb-2 align-top" style={{ color: '#374151' }}>Patient ID:</td>
                                    <td className="font-medium pb-2 align-top" style={{ color: '#111827' }}>{report.patient.patient_id}</td>
                                </tr>
                                )}
                                <tr>
                                    <td className="font-bold pb-2 align-top" style={{ color: '#374151' }}>Age / Gender:</td>
                                    <td className="font-medium pb-2 align-top" style={{ color: '#111827' }}>{report.patient.age} / {report.patient.gender === 'M' ? 'Male' : 'Female'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Right Column: Study */}
                    <div className="w-1/2 bg-gray-50 p-4">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr>
                                    <td className="font-bold w-[100px] pb-2 align-top" style={{ color: '#374151' }}>Modality:</td>
                                    <td className="font-medium pb-2 align-top" style={{ color: '#111827' }}>{report.study.modality}</td>
                                </tr>
                                <tr>
                                    <td className="font-bold pb-2 align-top" style={{ color: '#374151' }}>Indication:</td>
                                    <td className="font-medium pb-2 align-top" style={{ color: '#111827' }}>{report.clinical_information.indication}</td>
                                </tr>
                                <tr>
                                    <td className="font-bold pb-2 align-top" style={{ color: '#374151' }}>Examination:</td>
                                    <td className="font-medium pb-2 align-top" style={{ color: '#111827' }}>{report.study.examination} {report.study.views ? `- ${report.study.views}` : ''}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 3. Main Content Body */}
            <div className="px-10 pb-10 space-y-8" style={{ display: 'block' }}>

                {/* Clinical History */}
                <section>
                    <h3 className="text-lg font-serif font-bold border-b pb-1 mb-3 uppercase tracking-wider" style={{ color: '#111827', borderColor: '#d1d5db' }}>
                        Clinical History
                    </h3>
                    <div className="text-base space-y-1" style={{ color: '#1f2937' }}>
                        <p>{report.clinical_information.history}</p>
                        <p><span className="font-bold">Symptoms: </span>{report.clinical_information.symptoms}</p>
                    </div>
                </section>

                {/* Findings */}
                <section>
                    <h3 className="text-lg font-serif font-bold border-b pb-1 mb-4 uppercase tracking-wider" style={{ color: '#111827', borderColor: '#d1d5db' }}>
                        Findings
                    </h3>
                    <div className="space-y-5">
                        {report.findings.map((finding, idx) => {
                            const status = finding.status?.toLowerCase() || 'normal';

                            // Use simpler inline styles for PDF safety
                            let statusColor = '#15803d'; // green-700
                            let bgColor = '#dcfce7'; // green-100
                            let label = 'NORMAL';

                            if (status === 'abnormal') {
                                statusColor = '#b91c1c'; // red-700
                                bgColor = '#fee2e2'; // red-100
                                label = 'ABNORMAL';
                            } else if (status === 'indeterminate') {
                                statusColor = '#854d0e'; // yellow-800
                                bgColor = '#fef9c3'; // yellow-100
                                label = 'INDETERMINATE';
                            } else if (status === 'post_procedural' || status === 'post-procedural') {
                                statusColor = '#1d4ed8'; // blue-700
                                bgColor = '#dbeafe'; // blue-100
                                label = 'POST-PROCEDURAL';
                            }

                            return (
                                <div key={idx} className="mb-4">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                        <span className="font-bold text-base" style={{ color: '#111827', paddingBottom: '2px', lineHeight: '1.2' }}>
                                            {finding.anatomical_region}
                                        </span>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '16px',
                                            padding: '0 8px',
                                            fontSize: '10px',
                                            borderRadius: '4px',
                                            border: `1px solid ${statusColor}`,
                                            backgroundColor: bgColor,
                                            color: statusColor,
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            lineHeight: '1'
                                        }}>
                                            {label}
                                        </span>
                                    </div>
                                    <div className="text-base leading-relaxed pl-1" style={{ color: '#1f2937' }}>
                                        {finding.observation}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Impression */}
                <section>
                    <h3 className="text-lg font-serif font-bold border-b pb-1 mb-3 uppercase tracking-wider" style={{ color: '#111827', borderColor: '#d1d5db' }}>
                        Impression
                    </h3>
                    <ul className="list-disc list-outside ml-4 space-y-2">
                        {report.impression.map((imp, idx) => (
                            <li key={idx} className="font-bold text-lg leading-relaxed pl-2" style={{ color: '#111827' }}>
                                {imp}
                            </li>
                        ))}
                    </ul>

                    {/* Urgency Inline */}
                    <div className="mt-4 flex items-center gap-2">
                        <span className="font-bold uppercase tracking-wider" style={{ color: '#1f2937' }}>Urgency:</span>
                        <span className="text-lg font-bold italic" style={{ color: urgencyColor }}>
                            {report.urgency}
                        </span>
                    </div>
                </section>

                {/* Recommendations */}
                {report.recommendations && report.recommendations.length > 0 && (
                    <section>
                        <h3 className="text-lg font-serif font-bold border-b pb-1 mb-3 uppercase tracking-wider" style={{ color: '#111827', borderColor: '#d1d5db' }}>
                            Recommendations
                        </h3>
                        <ul className="list-disc list-outside ml-4 space-y-1">
                            {report.recommendations.map((rec, idx) => (
                                <li key={idx} className="text-base pl-2" style={{ color: '#1f2937' }}>{rec}</li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {/* 4. Footer Section */}
            <div className="mt-auto px-10 pb-10 pt-6 border-t-2" style={{ borderColor: '#1f2937' }}>
                <div className="flex justify-between items-end">
                    {/* Left: Prepared By */}
                    <div>
                        <p className="text-sm font-medium mb-1" style={{ color: '#111827' }}>Prepared by :</p>
                        <p className="font-bold text-lg capitalize" style={{ color: '#111827' }}>{report.report_footer.prepared_by}</p>
                        <p className="text-sm text-gray-500" style={{ color: '#6b7280' }}>{report.report_footer.department}</p>
                    </div>

                    {/* Right: Approved By + Signature */}
                    {report.report_footer.report_status === 'Approved' && report.report_footer.approved_by && (
                        <div className="text-right">
                            <p className="text-sm font-medium mb-1" style={{ color: '#111827' }}>Approved by:</p>
                            <p className="font-bold text-lg capitalize mb-2" style={{ color: '#111827' }}>{report.report_footer.approved_by}</p>
                            {report.report_footer.signature ? (
                                <img
                                    src={report.report_footer.signature}
                                    alt="Signature"
                                    className="h-16 ml-auto object-contain"
                                />
                            ) : (
                                <div className="h-16 w-32 ml-auto border border-dashed flex items-center justify-center text-xs text-gray-400" style={{ borderColor: '#d1d5db', color: '#9ca3af' }}>
                                    (Signed)
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Disclaimer */}
                <div className="mt-8 text-center border-t pt-4" style={{ borderColor: '#e5e7eb' }}>
                    <p className="text-xs font-medium" style={{ color: '#6b7280' }}>
                        {report.disclaimer}
                    </p>
                </div>
            </div>
        </div>
    );
};

export const ModernTemplate: React.FC<ReportTemplateProps> = ({ report }) => {
    const statusColor = report.report_footer.report_status === 'Approved' ? 'bg-green-100 text-green-800' :
        report.report_footer.report_status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';

    return (
        <div className="max-w-4xl mx-auto bg-white shadow-lg min-h-full font-sans html2pdf__page-break" id="report-full-content-modern">
            {/* Header - Blue Bar */}
            <div className="bg-slate-900 text-white p-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-wide uppercase">{report.report_header.hospital_name}</h1>
                        <p className="text-slate-400 font-medium">{report.report_header.department}</p>
                    </div>
                    <div className="text-right">
                        <div className="inline-block px-3 py-1 bg-slate-800 rounded border border-slate-700 text-xs font-mono mb-1">
                            ID: {report.report_header.report_id}
                        </div>
                        <p className="text-sm text-slate-400">{new Date(report.report_header.report_date).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* Patient Info Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-8 py-4">
                <div className="grid grid-cols-3 gap-6 text-sm">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Patient</p>
                        <p className="font-bold text-slate-900 text-lg">{report.patient.name}</p>
                        <p className="text-slate-600">{report.patient.age}Y • {report.patient.gender === 'M' ? 'Male' : 'Female'}</p>
                        {report.patient.patient_id && <p className="text-xs text-slate-500 font-mono">ID: {report.patient.patient_id}</p>}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Exam</p>
                        <p className="font-semibold text-slate-900">{report.study.modality}</p>
                        <p className="text-slate-600">{report.study.examination}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Indication</p>
                        <p className="font-medium text-slate-900 line-clamp-2">{report.clinical_information.indication}</p>
                    </div>
                </div>
            </div>

            <div className="p-8 space-y-8 text-gray-800">
                {/* Findings with Modern Styling */}
                <section>
                    <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-8 h-0.5 bg-blue-600"></span>
                        Findings
                    </h3>
                    <div className="grid gap-4">
                        {report.findings.map((finding, idx) => {
                            const status = finding.status?.toLowerCase() || 'normal';
                            let cardStyle = 'bg-white border-slate-100 shadow-sm';
                            let textColor = 'text-slate-600';
                            let badge = null;

                            if (status === 'abnormal') {
                                cardStyle = 'bg-red-50 border-red-100';
                                textColor = 'text-red-900';
                                badge = <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase">Abnormal</span>;
                            } else if (status === 'indeterminate') {
                                cardStyle = 'bg-yellow-50 border-yellow-100';
                                textColor = 'text-yellow-900';
                                badge = <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full uppercase">Indeterminate</span>;
                            } else if (status === 'post_procedural' || status === 'post-procedural') {
                                cardStyle = 'bg-blue-50 border-blue-100';
                                textColor = 'text-blue-900';
                                badge = <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">Post-Procedural</span>;
                            }

                            return (
                                <div key={idx} className={`p-4 rounded-lg border ${cardStyle}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-slate-900">{finding.anatomical_region}</span>
                                        {badge}
                                    </div>
                                    <p className={`text-sm leading-relaxed ${textColor}`}>{finding.observation}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Impression Box */}
                <section className="bg-slate-50 border-l-4 border-blue-600 p-6 rounded-r-lg">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3">Impression</h3>
                    <ul className="space-y-3">
                        {report.impression.map((imp, idx) => (
                            <li key={idx} className="flex gap-3 text-slate-900 font-semibold text-base">
                                <span className="text-blue-500 mt-1.5">•</span>
                                {imp}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Signatures Modern */}
                <div className="flex justify-between items-end pt-12 mt-4 border-t border-slate-100">
                    <div>
                        <p className="text-xs uppercase text-slate-400 font-bold tracking-wider">Report Status</p>
                        <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                            {report.report_footer.report_status}
                        </span>
                    </div>
                    {report.report_footer.approved_by && (
                        <div className="text-right">
                            {report.report_footer.signature && (
                                <img src={report.report_footer.signature} className="h-12 ml-auto mb-2 opacity-80" alt="Signed" />
                            )}
                            <p className="font-bold text-slate-900">{report.report_footer.approved_by}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Approved Radiologist</p>
                        </div>
                    )}
                </div>
            </div>
            {/* Footer Strip */}
            <div className="bg-slate-50 py-3 text-center border-t border-slate-200">
                <p className="text-[10px] text-slate-400">{report.disclaimer}</p>
            </div>
        </div>
    );
};

export const MinimalTemplate: React.FC<ReportTemplateProps> = ({ report }) => {
    return (
        <div className="max-w-4xl mx-auto bg-white min-h-full font-sans text-sm p-8 html2pdf__page-break" id="report-full-content-minimal">
            {/* Minimal Header */}
            <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-2">
                <div>
                    <h1 className="font-bold text-xl uppercase tracking-tighter">{report.report_header.hospital_name}</h1>
                    <p className="text-xs uppercase tracking-widest">{report.report_header.department}</p>
                </div>
                <div className="text-right text-xs font-mono">
                    {report.report_header.report_id} | {new Date(report.report_header.report_date).toLocaleDateString()}
                </div>
            </div>

            {/* Compact Details Grid */}
            <div className="grid grid-cols-4 gap-4 py-3 border-b border-black mb-6">
                <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-500">Patient</span>
                    <span className="font-bold block truncate">{report.patient.name}</span>
                    {report.patient.patient_id && <span className="block text-[10px] font-mono text-gray-400">ID: {report.patient.patient_id}</span>}
                </div>
                <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-500">Details</span>
                    <span className="block">{report.patient.age} / {report.patient.gender}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-500">Exam</span>
                    <span className="block truncate">{report.study.modality}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-500">Indication</span>
                    <span className="block truncate">{report.clinical_information.indication}</span>
                </div>
            </div>

            {/* High Density Content */}
            <div className="space-y-4">
                <div className="grid grid-cols-[120px_1fr] gap-4">
                    <h3 className="font-bold text-xs uppercase text-gray-500 pt-1">History</h3>
                    <p className="leading-snug">{report.clinical_information.history}. <span className="italic">Symptoms: {report.clinical_information.symptoms}</span></p>
                </div>

                <div className="grid grid-cols-[120px_1fr] gap-4">
                    <h3 className="font-bold text-xs uppercase text-gray-500 pt-1">Findings</h3>
                    <div className="space-y-2">
                        {report.findings.map((finding, idx) => {
                            const status = finding.status?.toLowerCase() || 'normal';
                            let badge = null;

                            if (status === 'abnormal') {
                                badge = <span className="ml-2 text-[10px] font-bold border border-black px-1">ABNORMAL</span>;
                            } else if (status === 'indeterminate') {
                                badge = <span className="ml-2 text-[10px] font-bold border border-black px-1 bg-gray-100">INDETERMINATE</span>;
                            } else if (status === 'post_procedural' || status === 'post-procedural') {
                                badge = <span className="ml-2 text-[10px] font-bold border border-black px-1">POST-PROCEDURAL</span>;
                            }

                            return (
                                <div key={idx} className="border-b border-gray-100 last:border-0 pb-1">
                                    <span className="font-bold mr-2 uppercase text-xs">{finding.anatomical_region}:</span>
                                    <span className={status === 'abnormal' ? 'font-semibold' : ''}>{finding.observation}</span>
                                    {badge}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-[120px_1fr] gap-4 pt-2">
                    <h3 className="font-bold text-xs uppercase text-gray-500 pt-1">Impression</h3>
                    <div className="bg-gray-50 p-3">
                        <ul className="list-decimal list-inside space-y-1">
                            {report.impression.map((imp, idx) => (
                                <li key={idx} className="font-bold leading-snug">{imp}</li>
                            ))}
                        </ul>
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs flex justify-between">
                            <span>Urgency: <span className="font-bold uppercase">{report.urgency}</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Footer */}
            <div className="mt-12 flex justify-between items-end border-t border-black pt-4">
                <div className="text-xs">
                    <p className="font-bold uppercase">Prepared By: {report.report_footer.prepared_by}</p>
                </div>
                {report.report_footer.approved_by && (
                    <div className="text-right">
                        {report.report_footer.signature && <img src={report.report_footer.signature} className="h-8 ml-auto mb-1" />}
                        <p className="text-xs font-bold uppercase border-t border-black inline-block min-w-[150px] pt-1 mt-1">
                            Approved: {report.report_footer.approved_by}
                        </p>
                    </div>
                )}
            </div>
            <p className="mt-8 text-[9px] text-gray-400 text-center">{report.disclaimer}</p>
        </div>
    );
};
