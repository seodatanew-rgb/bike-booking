const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '../../uploads/bikes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `bike-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const extOk   = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk  = allowed.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new Error('Only JPEG, PNG and WebP images are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

// Middleware: accept up to 5 images under the field name "images"
const uploadBikeImages = upload.array('images', 5);

// Wrap multer to forward errors to Express error handler
const handleUpload = (req, res, next) => {
  uploadBikeImages(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ success: false, message: 'Each image must be under 5 MB.' });
    if (err.code === 'LIMIT_FILE_COUNT')
      return res.status(400).json({ success: false, message: 'Maximum 5 images per bike.' });
    return res.status(400).json({ success: false, message: err.message });
  });
};

module.exports = { handleUpload };
