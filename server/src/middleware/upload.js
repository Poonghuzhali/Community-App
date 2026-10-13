const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('../config');
const { ApiError } = require('../utils/errors');

const UPLOAD_SUB = 'uploads';

function ensureUploadDir() {
  const dir = path.isAbsolute(config.uploadDir)
    ? config.uploadDir
    : path.join(__dirname, '..', '..', config.uploadDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      cb(null, ensureUploadDir());
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const safeExt = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

function fileFilter(req, file, cb) {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ok.includes(file.mimetype)) return cb(ApiError.unprocessable('Only JPG, PNG, WEBP or GIF images are allowed'));
  return cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: config.maxUploadBytes, files: 1 } });

const singleUpload = (field = 'image') => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (err) return next(err instanceof ApiError ? err : ApiError.badRequest(err.message));
    return next();
  });
};

module.exports = { singleUpload, ensureUploadDir, UPLOAD_SUB };
