import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret'
});

// Use Cloudinary storage if configured, otherwise use local storage
let storage;

if (process.env.CLOUDINARY_CLOUD_NAME) {
  // Cloudinary storage
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'intezo/profiles',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      public_id: (req, file) => {
        const userType = req.clinic ? 'clinic' : 'doctor';
        const userId = req.clinic?.id || req.doctor?.id;
        const timestamp = Date.now();
        return `${userType}_${userId}_${timestamp}`;
      }
    }
  });
} else {
  // Local storage fallback
  const uploadsDir = 'uploads/profiles';
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const userType = req.clinic ? 'clinic' : 'doctor';
      const userId = req.clinic?.id || req.doctor?.id;
      const timestamp = Date.now();
      const extension = path.extname(file.originalname);
      cb(null, `${userType}_${userId}_${timestamp}${extension}`);
    }
  });
}

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

export default upload;