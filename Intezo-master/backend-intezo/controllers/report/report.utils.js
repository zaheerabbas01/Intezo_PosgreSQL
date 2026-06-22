import PDFDocument from 'pdfkit';

// Render reports in memory. Persistence is handled separately so production
// can use a private S3 bucket while local development can use private disk.
export const generateReportPDF = async (report) => new Promise(async (resolve, reject) => {
  const chunks = [];
  const doc = new PDFDocument({ size: 'A4', margin: 60 });

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  try {
    const primaryColor = '#4A90A4';
    const textColor = '#333333';
    let y = 60;

    if (report.clinic?.profilePhoto) {
      try {
        const response = await fetch(report.clinic.profilePhoto, {
          signal: AbortSignal.timeout(3000)
        });
        if (!response.ok) throw new Error(`Logo request failed with ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        doc.image(buffer, 250, y, { width: 60 });
        y += 70;
      } catch (_error) {
        y += 20;
      }
    }

    doc.fillColor(primaryColor).fontSize(18).text(report.clinic?.name || 'Clinic', 0, y, { align: 'center' });
    doc.fontSize(10).fillColor('#666666').text(report.clinic?.address || '', { align: 'center' });

    y = doc.y + 30;
    doc.fillColor(textColor).fontSize(16).text(report.reportType === 'lab_test' ? 'LAB REPORT' : 'MEDICAL REPORT', { align: 'center' });

    y = doc.y + 30;
    doc.fontSize(10).fillColor(primaryColor).text('PATIENT INFO', 60, y);
    doc.text('VISIT INFO', 320, y);

    y += 15;
    doc.fillColor(textColor)
      .text(`Name: ${report.patientName || report.patient?.name || ''}`, 60, y)
      .text(`Doctor: Dr. ${report.doctor?.name || ''}`, 320, y);

    const sections = [
      { label: 'SYMPTOMS', value: report.symptoms },
      { label: 'DIAGNOSIS', value: report.diagnosis },
      { label: 'TREATMENT', value: report.treatment }
    ];

    sections.forEach((section) => {
      if (!section.value) return;
      y = doc.y + 20;
      doc.fillColor(primaryColor).text(section.label, 60, y);
      doc.fillColor(textColor).text(section.value, 60, doc.y + 5, { width: 480 });
    });

    if (report.reportType === 'lab_test' && report.labTests?.length > 0) {
      y = doc.y + 20;
      doc.fillColor(primaryColor).text('TEST RESULTS', 60, y);
      report.labTests.forEach((test) => {
        doc.fillColor(textColor).fontSize(9)
          .text(`${test.testName}: ${test.result} ${test.unit || ''} (${test.status})`, 70, doc.y + 5);
      });
    }

    doc.end();
  } catch (error) {
    doc.destroy();
    reject(error);
  }
});
