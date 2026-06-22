import fs from 'fs';
import 'dotenv/config';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const reportsBucket = process.env.REPORTS_S3_BUCKET;
const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const localReportsDir = path.resolve('uploads/reports');
const s3 = new S3Client({ region: awsRegion });

const objectKey = (reportId) => `reports/report-${reportId}.pdf`;
const localFilePath = (reportId) => path.join(localReportsDir, `report-${reportId}.pdf`);

export const storeReportPDF = async (reportId, pdfBuffer) => {
  if (reportsBucket) {
    const key = objectKey(reportId);
    await s3.send(new PutObjectCommand({
      Bucket: reportsBucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      CacheControl: 'private, no-store',
      ServerSideEncryption: 'AES256'
    }));
    return `s3://${reportsBucket}/${key}`;
  }

  await fsPromises.mkdir(localReportsDir, { recursive: true });
  await fsPromises.writeFile(localFilePath(reportId), pdfBuffer, { mode: 0o600 });
  return `local://report-${reportId}.pdf`;
};

export const openStoredReportPDF = async (storageReference, reportId) => {
  if (storageReference?.startsWith('s3://')) {
    const match = storageReference.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error('Invalid report storage reference');
    const response = await s3.send(new GetObjectCommand({ Bucket: match[1], Key: match[2] }));
    return { stream: response.Body, contentLength: response.ContentLength };
  }

  // Legacy local URLs are deliberately not trusted for path resolution.
  // The report ID determines the only file path that may be opened.
  const filePath = localFilePath(reportId);
  try {
    const stat = await fsPromises.stat(filePath);
    return { stream: fs.createReadStream(filePath), contentLength: stat.size };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};
