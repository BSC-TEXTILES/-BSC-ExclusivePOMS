/**
 * File upload security middleware.
 * Validates file types, sizes, and names before storage.
 */
import path from 'node:path';

// Dangerous file extensions that should never be uploaded
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.vbe', '.wsf', '.wsh',
  '.js', '.jse', '.ps1', '.psm1', '.psd1', '.psc1', '.reg', '.inf',
  '.php', '.php3', '.php4', '.php5', '.phtml', '.phps',
  '.py', '.pyc', '.pyw', '.rb', '.pl', '.cgi', '.asp', '.aspx', '.jsp', '.jspx',
  '.sh', '.bash', '.csh', '.ksh', '.zsh',
  '.htaccess', '.htpasswd', '.env', '.config',
  '.sql', '.db', '.sqlite', '.sqlite3',
  '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',  // archives (blocked for upload)
]);

// Safe file extensions for allowed upload types
const SAFE_IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico', '.svg',
]);

const SAFE_DOCUMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.csv', '.txt', '.rtf', '.odt', '.ods',
]);

const SAFE_ALL_EXTENSIONS = new Set([
  ...SAFE_IMAGE_EXTENSIONS,
  ...SAFE_DOCUMENT_EXTENSIONS,
  '.mp4', '.webm', '.avi', '.mov',  // video
  '.mp3', '.wav', '.ogg',           // audio
]);

// MIME type to extension mapping for verification
const SAFE_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'application/rtf',
];

/**
 * Check if a file extension is safe for upload.
 */
export function isSafeExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return SAFE_ALL_EXTENSIONS.has(ext);
}

/**
 * Check if a file extension is blocked (dangerous).
 */
export function isBlockedExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return BLOCKED_EXTENSIONS.has(ext);
}

/**
 * Check if a MIME type is safe.
 */
export function isSafeMimeType(mimetype) {
  if (!mimetype) return false;
  return SAFE_MIME_PREFIXES.some((prefix) => mimetype.startsWith(prefix));
}

/**
 * Validate uploaded files before they reach storage.
 * Place this BEFORE multer in the route chain.
 */
export function validateFileUpload(options = {}) {
  const {
    maxFiles = 20,
    maxSizeMB = 200,
    allowedTypes = 'all', // 'image', 'document', 'all'
  } = options;

  return (req, res, next) => {
    // Check Content-Length header as early as possible
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (contentLength > maxSizeBytes * maxFiles) {
      return res.status(413).json({
        error: { message: `Request too large — maximum ${maxSizeMB}MB per file, ${maxFiles} files allowed` },
      });
    }

    // Content-type must be multipart
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) {
      // Allow non-file requests through (JSON bodies, etc.)
      return next();
    }

    next();
  };
}

/**
 * Post-upload validation middleware.
 * Run this AFTER multer to validate the uploaded files' metadata.
 */
export function validateUploadedFiles(options = {}) {
  const { allowedTypes = 'all' } = options;

  return (req, res, next) => {
    const files = req.files;
    if (!files || !files.length) return next();

    const rejected = [];

    for (const file of files) {
      // Check blocked extensions
      if (isBlockedExtension(file.originalname)) {
        rejected.push({ filename: file.originalname, reason: 'Blocked file type (executable or script)' });
        continue;
      }

      // Check MIME type
      if (!isSafeMimeType(file.mimetype)) {
        rejected.push({ filename: file.originalname, reason: 'Unsafe MIME type' });
        continue;
      }

      // Type-specific checks
      if (allowedTypes === 'image' && !file.mimetype.startsWith('image/')) {
        rejected.push({ filename: file.originalname, reason: 'Only image files are allowed' });
        continue;
      }
    }

    if (rejected.length) {
      // Remove rejected files from disk
      const fs = await import('node:fs/promises');
      for (const file of files) {
        if (rejected.some((r) => r.filename === file.originalname)) {
          try { await fs.unlink(file.path); } catch {}
        }
      }
      return res.status(400).json({
        error: {
          message: `${rejected.length} file(s) rejected`,
          details: rejected,
        },
      });
    }

    next();
  };
}

/**
 * Sanitize filename: remove path components, dangerous characters.
 */
export function safeFilename(original) {
  const base = path.basename(original || 'file');
  return base
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // replace non-safe chars
    .replace(/_{2,}/g, '_')              // collapse multiple underscores
    .slice(0, 120);                      // limit length
}
