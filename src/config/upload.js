/**
 * ==========================================
 * 🔧 CONFIGURAÇÕES UPLOAD
 * ==========================================
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../utils/errors');

/**
 * Configuração de upload de arquivos com validações de segurança
 * Suporta armazenamento local e AWS S3
 */

// Configurações gerais
const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ],
  allowedExtensions: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,csv,txt').split(','),
  uploadPath: process.env.UPLOAD_PATH || 'uploads/',
  useS3: process.env.AWS_S3_BUCKET ? true : false
};

// Storage local
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), uploadConfig.uploadPath);
    
    // Criar diretório se não existir
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único: timestamp-uuid.extensao
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}-${uuid}${extension}`;
    
    cb(null, filename);
  }
});

// Storage S3 (AWS)
const s3Storage = require('multer-s3')({
  s3: new (require('aws-sdk')).S3({
    region: process.env.AWS_S3_REGION || process.env.AWS_REGION
  }),
  bucket: process.env.AWS_S3_BUCKET,
  acl: 'private', // Arquivos privados por padrão
  key: (req, file, cb) => {
    const companyId = req.user?.companyId || 'no-company';
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const extension = path.extname(file.originalname);
    
    // Estrutura: company/year/month/filename
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const key = `company-${companyId}/${year}/${month}/${timestamp}-${uuid}${extension}`;
    cb(null, key);
  },
  metadata: (req, file, cb) => {
    cb(null, {
      companyId: req.user?.companyId?.toString() || 'unknown',
      userId: req.user?.id?.toString() || 'unknown',
      originalName: file.originalname,
      uploadDate: new Date().toISOString()
    });
  },
  contentType: multer.AUTO_CONTENT_TYPE
});

// Função de filtro de arquivos
const fileFilter = (req, file, cb) => {
  // Verificar MIME type
  if (!uploadConfig.allowedMimeTypes.includes(file.mimetype)) {
    return cb(new ApiError(400, `Tipo de arquivo não permitido: ${file.mimetype}`), false);
  }
  
  // Verificar extensão
  const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (!uploadConfig.allowedExtensions.includes(extension)) {
    return cb(new ApiError(400, `Extensão de arquivo não permitida: .${extension}`), false);
  }
  
  // Verificar tamanho (será verificado pelo multer também)
  if (file.size > uploadConfig.maxFileSize) {
    return cb(new ApiError(400, `Arquivo muito grande. Máximo: ${uploadConfig.maxFileSize / 1024 / 1024}MB`), false);
  }
  
  cb(null, true);
};

// Configuração do multer
const upload = multer({
  storage: uploadConfig.useS3 ? s3Storage : localStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: uploadConfig.maxFileSize,
    files: 10, // Máximo 10 arquivos por upload
    fields: 20, // Máximo 20 campos de formulário
    fieldSize: 2 * 1024 * 1024 // 2MB por campo
  }
});

// Middleware para upload único
const uploadSingle = (fieldName = 'file') => {
  return upload.single(fieldName);
};

// Middleware para múltiplos uploads
const uploadMultiple = (fieldName = 'files', maxCount = 5) => {
  return upload.array(fieldName, maxCount);
};

// Middleware para campos múltiplos
const uploadFields = (fields) => {
  return upload.fields(fields);
};

// Middleware de tratamento de erros de upload
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `Arquivo muito grande. Tamanho máximo: ${uploadConfig.maxFileSize / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Muitos arquivos enviados',
        code: 'TOO_MANY_FILES'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Campo de arquivo inesperado',
        code: 'UNEXPECTED_FILE'
      });
    }
  }
  
  next(error);
};

module.exports = {
  uploadConfig,
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError
};