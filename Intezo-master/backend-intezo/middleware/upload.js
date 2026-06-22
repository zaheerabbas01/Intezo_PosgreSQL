import multer from 'multer';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { v2 as cloudinary } from 'cloudinary';

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

const uploadsDir = path.resolve('uploads/profiles');
let storage;

if (cloudinaryConfigured) {
  storage = multer.memoryStorage();
} else {
  fs.mkdirSync(uploadsDir, { recursive: true });
  storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (req, file, callback) => {
      const userType = req.clinic ? 'clinic' : 'doctor';
      const userId = req.clinic?.id || req.doctor?.id;
      callback(null, `${userType}_${userId}_${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
    }
  });
}

const fileFilter = (_req, file, callback) => {
  const allowedExtensions = /jpeg|jpg|png|gif|webp/;
  const validExtension = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const validMimeType = allowedExtensions.test(file.mimetype);
  callback(validExtension && validMimeType ? null : new Error('Only image files are allowed'), validExtension && validMimeType);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter
});

export const persistProfilePhoto = async (file, userType, userId) => {
  if (!file) throw new Error('No file uploaded');

  if (!cloudinaryConfigured) {
    return `/uploads/profiles/${file.filename}`;
  }

  const publicId = `${userType}_${userId}_${Date.now()}`;
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: 'intezo/profiles',
      public_id: publicId,
      resource_type: 'image',
      overwrite: false
    }, (error, value) => error ? reject(error) : resolve(value));
    stream.end(file.buffer);
  });

  return result.secure_url;
};

export const deleteProfilePhotoAsset = async (photoUrl) => {
  if (!photoUrl) return;

  if (cloudinaryConfigured && photoUrl.includes('res.cloudinary.com/')) {
    const uploadPath = photoUrl.split('/upload/')[1];
    if (!uploadPath) return;
    const publicId = uploadPath.replace(/^v\d+\//, '').replace(/\.[^.]+$/, '');
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return;
  }

  if (photoUrl.startsWith('/uploads/profiles/')) {
    const filePath = path.join(uploadsDir, path.basename(photoUrl));
    if (filePath.startsWith(uploadsDir)) {
      await fsPromises.unlink(filePath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
};

export const cleanupFailedUpload = async (file) => {
  if (!file?.path || cloudinaryConfigured) return;
  const filePath = path.resolve(file.path);
  if (filePath.startsWith(uploadsDir)) {
    await fsPromises.unlink(filePath).catch(() => {});
  }
};

export default upload;
