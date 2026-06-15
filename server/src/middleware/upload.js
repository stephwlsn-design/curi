const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/design-ideas');
const USER_DESIGN_DIR = path.join(__dirname, '../../uploads/user-designs');

[UPLOAD_DIR, USER_DESIGN_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const makeStorage = (destDir, prefix = '') => multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, destDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]/gi, '').slice(0, 40);
    const safe = `${req.user._id}-${Date.now()}-${prefix}${base || 'design'}${ext}`;
    cb(null, safe);
  },
});

const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
};

const uploadDesignIdea = multer({
  storage: makeStorage(UPLOAD_DIR),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const uploadUserDesigns = multer({
  storage: makeStorage(USER_DESIGN_DIR, 'ud-'),
  fileFilter: imageFilter,
  limits: { fileSize: 12 * 1024 * 1024, files: 30 },
});

module.exports = { uploadDesignIdea, uploadUserDesigns, UPLOAD_DIR, USER_DESIGN_DIR };
