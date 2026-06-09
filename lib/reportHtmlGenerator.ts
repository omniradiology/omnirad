import { ReportData } from "@/types";

/**
 * Report HTML Generator - PDF Compatible
 *
 * Generates a pure inline-styled HTML string that matches the selected template.
 * 
 * Rules for html2pdf.js compatibility:
 * - NO Tailwind classes, NO CSS variables, NO oklab colors
 * - ALL styles inline with hex colors
 * - Uses tables/flexbox with inline styles for layouts
 */

export function generateReportHtml(report: ReportData, template: 'standard' | 'modern' | 'minimal' = 'standard', logoUrl?: string): string {
    switch (template) {
        case 'modern':
            return generateModernHtml(report, logoUrl);
        case 'minimal':
            return generateMinimalHtml(report, logoUrl);
        case 'standard':
        default:
            return generateStandardHtml(report, logoUrl);
    }
}

function generateStandardHtml(report: ReportData, logoUrl?: string): string {
    const formattedDate = new Date(report.report_header.report_date).toLocaleString();

    // Urgency color
    const urgencyColor = report.urgency === 'Critical' ? '#dc2626' :
        report.urgency === 'Urgent' ? '#ea580c' : '#16a34a';

    // Build findings HTML
    const findingsHtml = report.findings.map(finding => {
        const status = (finding.status || 'normal').toLowerCase();
        let statusColor = '#15803d';
        let bgColor = '#dcfce7';
        let label = 'NORMAL';

        if (status === 'abnormal') {
            statusColor = '#b91c1c';
            bgColor = '#fee2e2';
            label = 'ABNORMAL';
        } else if (status === 'indeterminate') {
            statusColor = '#854d0e';
            bgColor = '#fef9c3';
            label = 'INDETERMINATE';
        } else if (status === 'post_procedural' || status === 'post-procedural' || status.includes('post')) {
            statusColor = '#1d4ed8';
            bgColor = '#dbeafe';
            label = 'POST-PROCEDURAL';
        }

        // Calculate SVG badge width based on text length (approx 6px per char + 12px padding)
        const charWidth = 6;
        const padding = 12;
        const svgWidth = (label.length * charWidth) + padding;
        const svgHeight = 18;

        // SVG Badge Construction
        const badgeSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
                <rect x="0.5" y="0.5" width="${svgWidth - 1}" height="${svgHeight - 1}" rx="4" ry="4" fill="${bgColor}" stroke="${statusColor}" stroke-width="1"/>
                <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="${statusColor}">${label}</text>
            </svg>
        `;
        // Encode SVG for data URI to ensure html2canvas compatibility
        const badgeDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg)}`;

        return `
            <div style="margin-bottom: 12px; page-break-inside: avoid;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                    <span style="font-weight: bold; font-size: 13px; color: #111827; line-height: 1.3;">
                        ${finding.anatomical_region}
                    </span>
                    <img src="${badgeDataUri}" alt="${label}" style="display: block; vertical-align: middle; height: ${svgHeight}px; width: ${svgWidth}px;" />
                </div>
                <div style="font-size: 12px; line-height: 1.5; padding-left: 2px; color: #1f2937;">
                    ${finding.observation}
                </div>
            </div>
        `;
    }).join('');

    // Build impressions HTML
    const impressionsHtml = report.impression.map(imp =>
        `<li style="margin-bottom: 4px; font-weight: bold; font-size: 13px; line-height: 1.5; color: #111827; padding-left: 4px;">${imp}</li>`
    ).join('');

    // Build recommendations HTML
    let recommendationsHtml = '';
    if (report.recommendations && report.recommendations.length > 0) {
        const recItems = report.recommendations.map(rec =>
            `<li style="margin-bottom: 2px; font-size: 12px; padding-left: 4px; color: #1f2937;">${rec}</li>`
        ).join('');
        recommendationsHtml = `
            <div style="margin-top: 16px;">
                <h3 style="font-size: 14px; font-family: Georgia, 'Times New Roman', serif; font-weight: bold; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; color: #111827;">
                    Recommendations
                </h3>
                <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                    ${recItems}
                </ul>
            </div>
        `;
    }

    // Signature / Approval footer
    let approvalHtml = '';
    if (report.report_footer.report_status === 'Approved' && report.report_footer.approved_by) {
        let signatureImg = '';
        if (report.report_footer.signature) {
            signatureImg = `<img src="${report.report_footer.signature}" alt="Signature" style="height: 40px; display: block; margin-left: auto; object-fit: contain; background: #ffffff;" />`;
        } else {
            signatureImg = `<div style="height: 40px; width: 100px; margin-left: auto; border: 1px dashed #d1d5db; text-align: center; line-height: 40px; font-size: 10px; color: #9ca3af;">(Signed)</div>`;
        }
        approvalHtml = `
            <td style="width: 50%; text-align: right; vertical-align: bottom;">
                <p style="font-size: 11px; font-weight: 500; margin: 0 0 2px 0; color: #111827;">Approved by:</p>
                <p style="font-weight: bold; font-size: 14px; text-transform: capitalize; margin: 0 0 4px 0; color: #111827;">${report.report_footer.approved_by}</p>
                ${signatureImg}
            </td>
        `;
    }

    // Rejection info  
    let rejectionHtml = '';
    if (report.report_footer.report_status === 'Rejected' && report.report_footer.rejection_reason) {
        rejectionHtml = `
            <div style="margin-top: 10px; padding: 8px 12px; background-color: #fee2e2; border: 1px solid #dc2626; border-radius: 3px;">
                <span style="font-weight: bold; color: #dc2626; font-size: 11px;">REJECTED: </span>
                <span style="color: #991b1b; font-size: 11px;">${report.report_footer.rejection_reason}</span>
            </div>
        `;
    }

    // Gender display
    const genderDisplay = report.patient.gender === 'M' ? 'Male' : report.patient.gender === 'F' ? 'Female' : report.patient.gender;

    // === MAIN TEMPLATE ===
    return `
        <div style="
            max-width: 210mm;
            margin: 0 auto;
            background-color: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            border: 1px solid #e5e7eb;
        ">
            <!-- 1. Header Section -->
            <div style="padding: 24px 28px 16px 28px; border-bottom: 2px solid #1f2937;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        ${logoUrl ? `
                        <td style="vertical-align: top; padding-right: 12px; width: 60px;">
                            <img src="${logoUrl}" alt="Hospital Logo" style="height: 50px; width: auto; object-fit: contain;" />
                        </td>
                        ` : ''}
                        <td style="vertical-align: top;">
                            <h1 style="font-size: 22px; font-family: Georgia, 'Times New Roman', serif; font-weight: bold; color: #111827; text-transform: uppercase; margin: 0 0 2px 0; letter-spacing: -0.3px;">
                                ${report.report_header.hospital_name}
                            </h1>
                            <p style="color: #4b5563; font-weight: 500; font-size: 13px; font-family: Georgia, 'Times New Roman', serif; font-style: italic; margin: 0;">
                                ${report.report_header.department}
                            </p>
                        </td>
                        <td style="text-align: right; vertical-align: top; font-size: 11px; color: #6b7280; font-weight: 500;">
                            <p style="margin: 0 0 2px 0;"><span style="font-weight: bold; color: #374151;">Report ID:</span> ${report.report_header.report_id}</p>
                            <p style="margin: 0;"><span style="font-weight: bold; color: #374151;">Date:</span> ${formattedDate}</p>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- 2. Patient & Study Details Box -->
            <div style="padding: 16px 28px;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
                    <tr>
                        <!-- Left Column: Patient -->
                        <td style="width: 50%; background-color: #f9fafb; padding: 10px 14px; border-right: 1px solid #e5e7eb; vertical-align: top;">
                            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                                <tr>
                                    <td style="font-weight: bold; color: #374151; width: 90px; padding-bottom: 4px; vertical-align: top;">Patient Name:</td>
                                    <td style="font-weight: bold; text-transform: uppercase; color: #111827; padding-bottom: 4px; vertical-align: top;">${report.patient.name}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #374151; padding-bottom: 4px; vertical-align: top;">Age / Gender:</td>
                                    <td style="font-weight: 500; color: #111827; padding-bottom: 4px; vertical-align: top;">${report.patient.age} / ${genderDisplay}</td>
                                </tr>
                            </table>
                        </td>
                        <!-- Right Column: Study -->
                        <td style="width: 50%; background-color: #f9fafb; padding: 10px 14px; vertical-align: top;">
                            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                                <tr>
                                    <td style="font-weight: bold; color: #374151; width: 80px; padding-bottom: 4px; vertical-align: top;">Modality:</td>
                                    <td style="font-weight: 500; color: #111827; padding-bottom: 4px; vertical-align: top;">${report.study.modality}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #374151; padding-bottom: 4px; vertical-align: top;">Indication:</td>
                                    <td style="font-weight: 500; color: #111827; padding-bottom: 4px; vertical-align: top;">${report.clinical_information.indication}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #374151; padding-bottom: 4px; vertical-align: top;">Examination:</td>
                                    <td style="font-weight: 500; color: #111827; padding-bottom: 4px; vertical-align: top;">${report.study.examination}${report.study.views ? ` - ${report.study.views}` : ''}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- 3. Main Content Body -->
            <div style="padding: 0 28px 20px 28px;">

                <!-- Clinical History -->
                <div style="margin-bottom: 16px;">
                    <h3 style="font-size: 14px; font-family: Georgia, 'Times New Roman', serif; font-weight: bold; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; color: #111827;">
                        Clinical History
                    </h3>
                    <div style="font-size: 12px; color: #1f2937;">
                        <p style="margin: 0 0 2px 0;">${report.clinical_information.history}</p>
                        <p style="margin: 0;"><span style="font-weight: bold;">Symptoms: </span>${report.clinical_information.symptoms}</p>
                    </div>
                </div>

                <!-- Findings -->
                <div style="margin-bottom: 16px;">
                    <h3 style="font-size: 14px; font-family: Georgia, 'Times New Roman', serif; font-weight: bold; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; color: #111827;">
                        Findings
                    </h3>
                    ${findingsHtml}
                </div>

                <!-- Impression -->
                <div style="margin-bottom: 16px;">
                    <h3 style="font-size: 14px; font-family: Georgia, 'Times New Roman', serif; font-weight: bold; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; color: #111827;">
                        Impression
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                        ${impressionsHtml}
                    </ul>
                    <div style="margin-top: 8px;">
                        <span style="font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; color: #1f2937;">Urgency:</span>
                        <span style="font-size: 14px; font-weight: bold; font-style: italic; color: ${urgencyColor}; margin-left: 6px;">
                            ${report.urgency}
                        </span>
                    </div>
                </div>

                <!-- Recommendations -->
                ${recommendationsHtml}

                ${rejectionHtml}
            </div>

            <!-- 4. Footer Section -->
            <div style="padding: 14px 28px 20px 28px; border-top: 2px solid #1f2937;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <!-- Left: Prepared By -->
                        <td style="width: 50%; vertical-align: bottom;">
                            <p style="font-size: 11px; font-weight: 500; margin: 0 0 2px 0; color: #111827;">Prepared by :</p>
                            <p style="font-weight: bold; font-size: 14px; text-transform: capitalize; margin: 0; color: #111827;">${report.report_footer.prepared_by}</p>
                            <p style="font-size: 11px; color: #6b7280; margin: 0;">${report.report_footer.department}</p>
                        </td>
                        <!-- Right: Approved By + Signature -->
                        ${approvalHtml}
                    </tr>
                </table>

                <!-- Disclaimer -->
                <div style="margin-top: 16px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                    <p style="font-size: 10px; font-weight: 500; color: #6b7280; margin: 0;">
                        ${report.disclaimer}
                    </p>
                </div>
            </div>
        </div>
    `;
}

function generateModernHtml(report: ReportData, logoUrl?: string): string {
    const formattedDate = new Date(report.report_header.report_date).toLocaleString();
    const genderDisplay = report.patient.gender === 'M' ? 'Male' : report.patient.gender === 'F' ? 'Female' : report.patient.gender;

    // Status color (header badge)
    const status = report.report_footer.report_status;
    let statusBg = '#dbeafe';
    let statusText = '#1e40af';
    if (status === 'Approved') { statusBg = '#dcfce7'; statusText = '#166534'; }
    if (status === 'Rejected') { statusBg = '#fee2e2'; statusText = '#991b1b'; }

    // Findings
    const findingsHtml = report.findings.map(finding => {
        const fStatus = (finding.status || 'normal').toLowerCase();
        let borderClass = 'border: 1px solid #f1f5f9; background-color: #ffffff;';
        let badge = '';

        if (fStatus === 'abnormal') {
            borderClass = 'border: 1px solid #fee2e2; background-color: #fef2f2;';
            badge = `<span style="font-size: 9px; font-weight: bold; background-color: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 999px; text-transform: uppercase;">ABNORMAL</span>`;
        } else if (fStatus === 'indeterminate') {
            borderClass = 'border: 1px solid #fef9c3; background-color: #fffbeb;';
            badge = `<span style="font-size: 9px; font-weight: bold; background-color: #fef9c3; color: #b45309; padding: 2px 6px; border-radius: 999px; text-transform: uppercase;">INDETERMINATE</span>`;
        } else if (fStatus === 'post_procedural' || fStatus.includes('post')) {
            borderClass = 'border: 1px solid #dbeafe; background-color: #eff6ff;';
            badge = `<span style="font-size: 9px; font-weight: bold; background-color: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 999px; text-transform: uppercase;">POST-PROCEDURAL</span>`;
        }

        return `
        <div style="padding: 10px; border-radius: 6px; margin-bottom: 10px; ${borderClass} page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: bold; color: #0f172a; font-size: 13px;">${finding.anatomical_region}</span>
                ${badge}
            </div>
            <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.4;">${finding.observation}</p>
        </div>`;
    }).join('');

    // Impressions
    const impressionHtml = report.impression.map(imp =>
        `<li style="margin-bottom: 6px; font-weight: 600; color: #0f172a; font-size: 13px; display: flex; align-items: flex-start;">
            <span style="color: #3b82f6; margin-right: 6px;">•</span>
            <span style="flex: 1;">${imp}</span>
        </li>`
    ).join('');

    // Signature
    let sigHtml = '';
    if (report.report_footer.approved_by && report.report_footer.report_status === 'Approved') {
        const sigImg = report.report_footer.signature ?
            `<img src="${report.report_footer.signature}" style="height: 40px; opacity: 0.8; margin-bottom: 4px; display: block; margin-left: auto;" />` : '';
        sigHtml = `
            <div style="text-align: right;">
                ${sigImg}
                <div style="font-weight: bold; color: #0f172a; font-size: 14px;">${report.report_footer.approved_by}</div>
                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Approved Radiologist</div>
            </div>
        `;
    }

    // Rejection info with modern style
    let rejectionHtml = '';
    if (report.report_footer.report_status === 'Rejected' && report.report_footer.rejection_reason) {
        rejectionHtml = `
            <div style="margin-top: 10px; padding: 8px 12px; background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 4px; margin-bottom: 16px;">
                <span style="font-weight: bold; color: #dc2626; font-size: 11px;">REJECTED: </span>
                <span style="color: #991b1b; font-size: 11px;">${report.report_footer.rejection_reason}</span>
            </div>
        `;
    }

    return `
    <div style="max-width: 210mm; margin: 0 auto; background: #fff; font-family: sans-serif; font-size: 12px; color: #334155; line-height: 1.4;">
        <!-- Header -->
        <div style="background-color: #0f172a; color: white; padding: 24px 32px;">
            <table style="width: 100%;">
                <tr>
                    ${logoUrl ? `
                    <td style="width: 60px; vertical-align: middle; padding-right: 16px;">
                        <img src="${logoUrl}" alt="Hospital Logo" style="height: 48px; width: auto; object-fit: contain; filter: brightness(0) invert(1);" />
                    </td>
                    ` : ''}
                    <td style="vertical-align: middle;">
                        <h1 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">${report.report_header.hospital_name}</h1>
                        <p style="margin: 4px 0 0 0; color: #94a3b8; font-weight: 500;">${report.report_header.department}</p>
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                        <div style="display: inline-block; background: #1e293b; border: 1px solid #334155; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; margin-bottom: 4px;">
                            ID: ${report.report_header.report_id}
                        </div>
                        <div style="font-size: 11px; color: #94a3b8;">${formattedDate}</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Patient Info -->
        <div style="background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 16px 32px;">
            <table style="width: 100%; font-size: 12px;">
                <tr>
                    <td style="width: 33%; vertical-align: top;">
                        <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Patient</div>
                        <div style="font-weight: bold; color: #0f172a; font-size: 14px;">${report.patient.name}</div>
                        <div style="color: #475569;">${report.patient.age}Y • ${genderDisplay}</div>
                    </td>
                    <td style="width: 33%; vertical-align: top;">
                        <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Exam</div>
                        <div style="font-weight: 600; color: #0f172a;">${report.study.modality}</div>
                        <div style="color: #475569;">${report.study.examination}</div>
                    </td>
                    <td style="width: 33%; vertical-align: top;">
                        <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Indication</div>
                        <div style="font-weight: 500; color: #0f172a;">${report.clinical_information.indication}</div>
                    </td>
                </tr>
            </table>
        </div>

        <div style="padding: 24px 32px;">
            ${rejectionHtml}
        
            <!-- Content -->
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">History</h3>
                <p style="font-size: 12px; color: #334155; margin: 0;">${report.clinical_information.history} <span style="color: #64748b; font-style: italic;">(${report.clinical_information.symptoms})</span></p>
            </div>

            <!-- Findings -->
            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 11px; font-weight: bold; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center;">
                    <span style="width: 20px; height: 2px; background: #2563eb; margin-right: 8px; display: inline-block;"></span>
                    Findings
                </h3>
                <div>${findingsHtml}</div>
            </div>

            <!-- Impression -->
            <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Impression</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">${impressionHtml}</ul>
            </div>

            <!-- Recommendations (if any) -->
            ${report.recommendations?.length ? `
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Recommendations</h3>
                    <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                        ${report.recommendations.map(r => `<li style="font-size: 12px; color: #334155; margin-bottom: 4px;">${r}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <!-- Footer / Signatures -->
            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: bold; margin-bottom: 4px;">Report Status</div>
                    <div style="display: inline-block; padding: 3px 10px; border-radius: 999px; background: ${statusBg}; color: ${statusText}; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                        ${status}
                    </div>
                </div>
                ${sigHtml}
            </div>

            <!-- Disclaimer -->
            <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="font-size: 9px; color: #cbd5e1; margin: 0;">${report.disclaimer}</p>
            </div>
        </div>
    </div>`;
}

function generateMinimalHtml(report: ReportData, logoUrl?: string): string {
    const formattedDate = new Date(report.report_header.report_date).toLocaleString();

    // Helper for rows
    function row(label: string, content: string) {
        return `
        <div style="display: flex; margin-bottom: 8px; page-break-inside: avoid;">
            <div style="width: 100px; font-weight: bold; font-size: 10px; color: #6b7280; text-transform: uppercase; padding-top: 2px;">${label}</div>
            <div style="flex: 1; font-size: 11px; color: #111827;">${content}</div>
        </div>`;
    }

    const findingsHtml = report.findings.map(finding => {
        const status = (finding.status || 'normal').toLowerCase();
        let badge = '';
        if (status === 'abnormal') badge = `<span style="display: inline-block; vertical-align: middle; margin-left: 8px; font-size: 9px; line-height: 1; font-weight: bold; border: 1px solid #000; padding: 2px 4px 1px 4px; border-radius: 2px;">ABNORMAL</span>`;
        if (status === 'post_procedural' || status.includes('post')) badge = `<span style="display: inline-block; vertical-align: middle; margin-left: 8px; font-size: 9px; line-height: 1; font-weight: bold; border: 1px solid #000; padding: 2px 4px 1px 4px; border-radius: 2px;">POST-PROCEDURAL</span>`;

        return `
        <div style="border-bottom: 1px solid #f3f4f6; padding-bottom: 4px; margin-bottom: 4px;">
            <span style="font-weight: bold; text-transform: uppercase; font-size: 11px; margin-right: 6px;">${finding.anatomical_region}:</span>
            <span style="font-size: 11px;">${finding.observation}</span>
            ${badge}
        </div>`;
    }).join('');

    const impressionsHtml = report.impression.map(imp =>
        `<li style="font-weight: bold; margin-bottom: 2px;">${imp}</li>`
    ).join('');

    // Rejection info minimal
    let rejectionHtml = '';
    if (report.report_footer.report_status === 'Rejected' && report.report_footer.rejection_reason) {
        rejectionHtml = `
            <div style="margin-bottom: 16px; border: 1px solid #000; padding: 8px;">
                <span style="font-weight: bold; color: #dc2626; font-size: 10px;">REJECTED: </span>
                <span style="font-size: 10px;">${report.report_footer.rejection_reason}</span>
            </div>
        `;
    }

    return `
    <div style="max-width: 210mm; margin: 0 auto; background: #fff; font-family: sans-serif; font-size: 11px; color: #000; padding: 30px;">
        <!-- Header -->
        <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="display: flex; align-items: center;">
                ${logoUrl ? `<img src="${logoUrl}" alt="Hospital Logo" style="height: 32px; width: auto; object-fit: contain; margin-right: 12px;" />` : ''}
                <div>
                    <h1 style="margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: -0.5px;">${report.report_header.hospital_name}</h1>
                    <p style="margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">${report.report_header.department}</p>
                </div>
            </div>
            <div style="text-align: right; font-family: monospace; font-size: 10px;">
                ${report.report_header.report_id} <br/> ${formattedDate}
            </div>
        </div>

        <!-- Grid Info -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; border-bottom: 1px solid #000; padding-bottom: 16px; margin-bottom: 20px;">
            <div>
                <div style="font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Patient</div>
                <div style="font-weight: bold; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${report.patient.name}</div>
            </div>
            <div>
                <div style="font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Details</div>
                <div>${report.patient.age} / ${report.patient.gender}</div>
            </div>
            <div>
                <div style="font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Exam</div>
                <div>${report.study.modality}</div>
            </div>
            <div>
                <div style="font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Indication</div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${report.clinical_information.indication}</div>
            </div>
        </div>

        ${rejectionHtml}

        <!-- Content -->
        ${row('History', `${report.clinical_information.history} <span style="font-style: italic;">(Symptoms: ${report.clinical_information.symptoms})</span>`)}
        
        <div style="display: flex; margin-bottom: 12px; page-break-inside: avoid;">
            <div style="width: 100px; font-weight: bold; font-size: 10px; color: #6b7280; text-transform: uppercase; padding-top: 2px;">Findings</div>
            <div style="flex: 1;">${findingsHtml}</div>
        </div>

        <div style="display: flex; margin-bottom: 12px; page-break-inside: avoid;">
            <div style="width: 100px; font-weight: bold; font-size: 10px; color: #6b7280; text-transform: uppercase; padding-top: 2px;">Impression</div>
            <div style="flex: 1; background: #f9fafb; padding: 10px;">
                <ul style="margin: 0; padding-left: 16px; list-style-type: decimal;">${impressionsHtml}</ul>
                <div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 10px; display: flex; justify-content: space-between;">
                    <span>URGENCY: <span style="font-weight: bold; text-transform: uppercase;">${report.urgency}</span></span>
                </div>
            </div>
        </div>

        <!-- Recommendations (if any) -->
        ${report.recommendations?.length ? `
            <div style="display: flex; margin-bottom: 12px; page-break-inside: avoid;">
                <div style="width: 100px; font-weight: bold; font-size: 10px; color: #6b7280; text-transform: uppercase; padding-top: 2px;">Recs</div>
                <div style="flex: 1;">
                    <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">
                        ${report.recommendations.map(r => `<li style="font-size: 11px;">${r}</li>`).join('')}
                    </ul>
                </div>
            </div>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top: 40px; border-top: 1px solid #000; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="font-size: 10px;">
                <span style="font-weight: bold; text-transform: uppercase;">Prepared By:</span> ${report.report_footer.prepared_by}
            </div>
            ${report.report_footer.approved_by && report.report_footer.report_status === 'Approved' ? `
                <div style="text-align: right;">
                    ${report.report_footer.signature ? `<img src="${report.report_footer.signature}" style="height: 30px; margin-bottom: 2px;" />` : ''}
                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; border-top: 1px solid #000; padding-top: 2px;">
                        Approved: ${report.report_footer.approved_by}
                    </div>
                </div>
            ` : ''}
        </div>
        <p style="margin-top: 20px; font-size: 8px; color: #9ca3af; text-align: center;">${report.disclaimer}</p>
    </div>`;
}
