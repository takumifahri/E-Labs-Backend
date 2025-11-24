import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import { FileImporter, ImportedUser } from '../../../../utils/fileImporter';

const prisma = new PrismaClient();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `users-import-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Check file extension
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('File harus berformat Excel (.xlsx atau .xls)'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export const uploadMiddleware = upload.single('excelFile');

/**
 * Import users from Excel file (supports single sheet, multiple sheets, or all sheets)
 */
export const importUsers = async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File Excel tidak ditemukan',
        data: null
      });
    }

    tempFilePath = req.file.path;

    // Get analysis of all sheets
    const sheetAnalysis = FileImporter.analyzeAllSheets(tempFilePath);
    console.log('Sheet analysis:', sheetAnalysis);

    // Get query parameters
    const sheetName = req.query.sheetName as string | undefined;
    const importMode = req.query.mode as 'single' | 'all' | 'multiple' || 'single';
    const selectedSheets = req.query.sheets ? String(req.query.sheets).split(',') : undefined;

    let importResult: any;

    switch (importMode) {
      case 'all':
        // Import from ALL sheets
        console.log('Importing from ALL sheets');
        importResult = await FileImporter.importUsersFromAllSheets(tempFilePath);
        break;
        
      case 'multiple':
        // Import from multiple specific sheets
        if (!selectedSheets || selectedSheets.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Parameter "sheets" diperlukan untuk mode multiple',
            data: { 
              sheetAnalysis: sheetAnalysis.sheets,
              availableSheets: sheetAnalysis.sheets.map(s => s.name),
              usage: 'Gunakan ?mode=multiple&sheets=Sheet1,Sheet2'
            }
          });
        }
        console.log('Importing from selected sheets:', selectedSheets);
        importResult = await FileImporter.importUsersFromMultipleSheets(tempFilePath, selectedSheets);
        break;
        
      default:
        // Import from single sheet (existing behavior)
        console.log('Importing from single sheet:', sheetName || 'auto-detected');
        
        // Validate single sheet
        const validation = FileImporter.validateExcelFile(tempFilePath, sheetName);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: 'Format file tidak valid',
            errors: validation.errors,
            data: {
              availableSheets: validation.availableSheets,
              sheetAnalysis: sheetAnalysis.sheets,
              suggestion: 'Coba gunakan ?mode=all untuk import semua sheets'
            }
          });
        }
        
        importResult = await FileImporter.importUsersFromExcel(tempFilePath, sheetName);
        break;
    }

    if (!importResult.success || !importResult.data || importResult.data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Gagal mengimpor data atau tidak ada data yang valid',
        errors: importResult.errors,
        data: {
          mode: importMode,
          totalRows: importResult.totalRows || 0,
          validRows: 0,
          invalidRows: importResult.totalRows || 0,
          sheetAnalysis: sheetAnalysis.sheets,
          sheetResults: importResult.sheetResults || {},
          suggestions: [
            'Periksa format kolom: NIM, Nama diperlukan',
            'KLP opsional, akan menggunakan DEFAULT jika kosong',
            'Coba mode=all untuk import semua sheets'
          ]
        }
      });
    }

    // Process and save users to database
    const saveResult = await saveUsersToDatabase(importResult.data);

    return res.status(200).json({
      success: true,
      message: `Berhasil mengimpor ${saveResult.successCount} user dari ${importResult.totalRows} baris (${importMode} mode)`,
      data: {
        mode: importMode,
        totalRows: importResult.totalRows,
        validRows: importResult.validRows,
        savedRows: saveResult.successCount,
        skippedRows: saveResult.skippedCount,
        duplicateRows: saveResult.duplicateCount,
        errors: [...(importResult.errors || []), ...saveResult.errors],
        sheetAnalysis: sheetAnalysis.sheets,
        sheetResults: importResult.sheetResults || {},
        processedSheets: importResult.processedSheets || [],
        duplicateUsers: saveResult.duplicateUsers || []
      }
    });

  } catch (error) {
    console.error('Error importing users:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengimpor data',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
};

/**
 * Save imported users to database
 */
async function saveUsersToDatabase(users: ImportedUser[]) {
  let successCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;
  const errors: string[] = [];
  const duplicateUsers: string[] = [];

  for (const user of users) {
    try {
      // Check if user already exists (by NIM)
      const existingUser = await prisma.user.findFirst({
        where: {
          NIM: user.NIM
        }
      });

      if (existingUser) {
        duplicateCount++;
        duplicateUsers.push(user.NIM);
        errors.push(`User dengan NIM ${user.NIM} sudah ada, dilewati`);
        continue;
      }

      // Get default role (assuming roleId 1 is student)
      const defaultRole = await prisma.role.findFirst({
        where: { id: 1 }
      });

      if (!defaultRole) {
        errors.push(`Role default tidak ditemukan untuk user ${user.NIM}`);
        skippedCount++;
        continue;
      }

      // Create new user
      await prisma.user.create({
        data: {
          KLP: user.KLP || 'DEFAULT',
          NIM: user.NIM,
          nama: user.nama,
          password: user.password,
          roleId: defaultRole.id,
          isActive: true,
          isBlocked: false
        }
      });

      successCount++;
      console.log(`✅ Created user: ${user.NIM} - ${user.nama} (${user.KLP}) ${user.sourceSheet ? `from sheet: ${user.sourceSheet}` : ''}`);

    } catch (error) {
      skippedCount++;
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        duplicateCount++;
        duplicateUsers.push(user.NIM);
        errors.push(`User dengan NIM ${user.NIM} sudah ada (constraint), dilewati`);
      } else {
        errors.push(`Error menyimpan user ${user.NIM}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return {
    successCount,
    skippedCount,
    duplicateCount,
    duplicateUsers,
    errors
  };
}

/**
 * Analyze all sheets in Excel file
 */
export const analyzeSheets = async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File Excel tidak ditemukan',
        data: null
      });
    }

    tempFilePath = req.file.path;
    const analysis = FileImporter.analyzeAllSheets(tempFilePath);

    return res.status(200).json({
      success: true,
      message: 'Analisis sheet berhasil',
      data: {
        ...analysis,
        importOptions: {
          single: 'Import dari satu sheet: ?sheetName=SheetName',
          all: 'Import semua sheets: ?mode=all',
          multiple: 'Import sheets tertentu: ?mode=multiple&sheets=Sheet1,Sheet2'
        }
      }
    });

  } catch (error) {
    console.error('Error analyzing sheets:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menganalisis sheet',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
};

/**
 * Get available sheets from uploaded Excel file (backward compatibility)
 */
export const getSheetInfo = async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File Excel tidak ditemukan',
        data: null
      });
    }

    tempFilePath = req.file.path;
    const sheetInfo = FileImporter.getSheetInfo(tempFilePath);

    return res.status(200).json({
      success: true,
      message: 'Informasi sheet berhasil diambil',
      data: sheetInfo
    });

  } catch (error) {
    console.error('Error getting sheet info:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil informasi sheet',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
};

/**
 * Preview Excel data before import
 */
export const previewExcelData = async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File Excel tidak ditemukan',
        data: null
      });
    }

    tempFilePath = req.file.path;
    const sheetName = req.query.sheetName as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const previewResult = FileImporter.getPreviewData(tempFilePath, sheetName, limit);

    if (!previewResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Gagal preview data',
        error: previewResult.error,
        data: {
          availableSheets: previewResult.availableSheets
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Preview data berhasil',
      data: previewResult
    });

  } catch (error) {
    console.error('Error previewing Excel data:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat preview data',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
};

/**
 * Generate and download import template
 */
export const getImportTemplate = async (req: Request, res: Response) => {
  try {
    const buffer = FileImporter.generateTemplate();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=template-import-users.xlsx');
    
    // Send file
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating template:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat template',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    });
  }
};

/**
 * Get template info (JSON response)
 */
export const getTemplateInfo = async (req: Request, res: Response) => {
  try {
    const templateInfo = FileImporter.getTemplateInfo();
    
    res.status(200).json({
      success: true,
      message: 'Template info berhasil diambil',
      data: templateInfo
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil template info',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    });
  }
};

const ImportController = {
  importUsers,
  analyzeSheets,
  getSheetInfo,
  previewExcelData,
  getImportTemplate,
  getTemplateInfo
};

export default ImportController;