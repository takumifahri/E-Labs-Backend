import xlsx from 'xlsx';
import argon2 from 'argon2';

export interface ImportedUser {
  KLP: string;
  NIM: string;
  nama: string;
  password: string;
  sourceSheet?: string;
}

export interface ImportResult {
  success: boolean;
  data?: ImportedUser[];
  errors?: string[];
  totalRows?: number;
  validRows?: number;
  processedSheets?: string[];
}

export interface MultiSheetImportResult {
  success: boolean;
  data?: ImportedUser[];
  errors?: string[];
  sheetResults: {
    [sheetName: string]: {
      success: boolean;
      totalRows: number;
      validRows: number;
      errors?: string[];
    };
  };
  totalRows: number;
  validRows: number;
}

export class FileImporter {
  /**
   * Import users from ALL sheets in Excel file
   * @param filePath - Path to the Excel file
   * @returns MultiSheetImportResult with data from all sheets
   */
  static async importUsersFromAllSheets(filePath: string): Promise<MultiSheetImportResult> {
    try {
      const workbook = xlsx.readFile(filePath);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return {
          success: false,
          errors: ['File Excel tidak memiliki sheet'],
          sheetResults: {},
          totalRows: 0,
          validRows: 0
        };
      }

      console.log(`Processing ALL sheets: ${workbook.SheetNames.join(', ')}`);

      const allUsers: ImportedUser[] = [];
      const allErrors: string[] = [];
      const sheetResults: { [key: string]: any } = {};
      let totalTotalRows = 0;
      let totalValidRows = 0;

      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        console.log(`\n=== Processing Sheet: ${sheetName} ===`);
        
        const sheetResult = await this.importUsersFromExcel(filePath, sheetName);
        
        // Track results per sheet
        sheetResults[sheetName] = {
          success: sheetResult.success,
          totalRows: sheetResult.totalRows || 0,
          validRows: sheetResult.validRows || 0,
          errors: sheetResult.errors
        };

        // Add sheet name to each user record
        if (sheetResult.data && sheetResult.data.length > 0) {
          const usersWithSheet = sheetResult.data.map(user => ({
            ...user,
            sourceSheet: sheetName
          }));
          allUsers.push(...usersWithSheet);
        }

        // Accumulate errors with sheet context
        if (sheetResult.errors && sheetResult.errors.length > 0) {
          const errorsWithContext = sheetResult.errors.map(error => 
            `Sheet "${sheetName}": ${error}`
          );
          allErrors.push(...errorsWithContext);
        }

        totalTotalRows += sheetResult.totalRows || 0;
        totalValidRows += sheetResult.validRows || 0;
      }

      return {
        success: allUsers.length > 0,
        data: allUsers,
        errors: allErrors.length > 0 ? allErrors : undefined,
        sheetResults,
        totalRows: totalTotalRows,
        validRows: totalValidRows
      };

    } catch (error) {
      console.error('Error importing from all sheets:', error);
      return {
        success: false,
        errors: [`Error membaca file Excel: ${error instanceof Error ? error.message : 'Unknown error'}`],
        sheetResults: {},
        totalRows: 0,
        validRows: 0
      };
    }
  }

  /**
   * Import users from multiple specific sheets
   * @param filePath - Path to the Excel file
   * @param sheetNames - Array of sheet names to process
   * @returns MultiSheetImportResult
   */
  static async importUsersFromMultipleSheets(filePath: string, sheetNames: string[]): Promise<MultiSheetImportResult> {
    try {
      const workbook = xlsx.readFile(filePath);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return {
          success: false,
          errors: ['File Excel tidak memiliki sheet'],
          sheetResults: {},
          totalRows: 0,
          validRows: 0
        };
      }

      console.log(`Processing specific sheets: ${sheetNames.join(', ')}`);
      console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);

      const allUsers: ImportedUser[] = [];
      const allErrors: string[] = [];
      const sheetResults: { [key: string]: any } = {};
      let totalTotalRows = 0;
      let totalValidRows = 0;

      // Validate requested sheets exist
      const invalidSheets = sheetNames.filter(name => !workbook.SheetNames.includes(name));
      if (invalidSheets.length > 0) {
        return {
          success: false,
          errors: [`Sheet tidak ditemukan: ${invalidSheets.join(', ')}. Available sheets: ${workbook.SheetNames.join(', ')}`],
          sheetResults: {},
          totalRows: 0,
          validRows: 0
        };
      }

      // Process each requested sheet
      for (const sheetName of sheetNames) {
        console.log(`\n=== Processing Sheet: ${sheetName} ===`);
        
        const sheetResult = await this.importUsersFromExcel(filePath, sheetName);
        
        // Track results per sheet
        sheetResults[sheetName] = {
          success: sheetResult.success,
          totalRows: sheetResult.totalRows || 0,
          validRows: sheetResult.validRows || 0,
          errors: sheetResult.errors
        };

        // Add sheet name to each user record
        if (sheetResult.data && sheetResult.data.length > 0) {
          const usersWithSheet = sheetResult.data.map(user => ({
            ...user,
            sourceSheet: sheetName
          }));
          allUsers.push(...usersWithSheet);
        }

        // Accumulate errors with sheet context
        if (sheetResult.errors && sheetResult.errors.length > 0) {
          const errorsWithContext = sheetResult.errors.map(error => 
            `Sheet "${sheetName}": ${error}`
          );
          allErrors.push(...errorsWithContext);
        }

        totalTotalRows += sheetResult.totalRows || 0;
        totalValidRows += sheetResult.validRows || 0;
      }

      return {
        success: allUsers.length > 0,
        data: allUsers,
        errors: allErrors.length > 0 ? allErrors : undefined,
        sheetResults,
        totalRows: totalTotalRows,
        validRows: totalValidRows
      };

    } catch (error) {
      console.error('Error importing from multiple sheets:', error);
      return {
        success: false,
        errors: [`Error membaca file Excel: ${error instanceof Error ? error.message : 'Unknown error'}`],
        sheetResults: {},
        totalRows: 0,
        validRows: 0
      };
    }
  }

  /**
   * Read and parse Excel file for user import
   * @param filePath - Path to the Excel file
   * @param sheetName - Optional sheet name to read from
   * @returns ImportResult with parsed user data
   */
  static async importUsersFromExcel(filePath: string, sheetName?: string): Promise<ImportResult> {
    try {
      // Read the Excel file
      const workbook = xlsx.readFile(filePath);

      // Determine which sheet to read
      let targetSheetName = sheetName;
      if (!targetSheetName) {
        // If no specific sheet name provided, try to find sheet with data
        for (const name of workbook.SheetNames) {
          const testWorksheet = workbook.Sheets[name];
          const testData = xlsx.utils.sheet_to_json(testWorksheet);
          if (testData && testData.length > 0) {
            console.log(`Found data in sheet: ${name}`);
            targetSheetName = name;
            break;
          }
        }

        // If still no sheet found, use first sheet
        if (!targetSheetName) {
          targetSheetName = workbook.SheetNames[0];
        }
      }

      console.log(`Reading from sheet: ${targetSheetName}`);
      console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);

      if (!workbook.Sheets[targetSheetName]) {
        return {
          success: false,
          errors: [`Sheet "${targetSheetName}" tidak ditemukan. Sheet yang tersedia: ${workbook.SheetNames.join(', ')}`],
          totalRows: 0,
          validRows: 0
        };
      }

      const worksheet = workbook.Sheets[targetSheetName];

      // Convert to JSON
      const rawData = xlsx.utils.sheet_to_json(worksheet);

      if (!rawData || rawData.length === 0) {
        return {
          success: false,
          errors: [`Sheet "${targetSheetName}" kosong atau tidak valid`],
          totalRows: 0,
          validRows: 0
        };
      }

      const users: ImportedUser[] = [];
      const errors: string[] = [];

      // Debug: Log first row to see column names
      console.log('First row data:', rawData[0]);
      console.log('Available columns:', Object.keys(rawData[0] as any));

      // Process each row
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i] as any;
        const rowNumber = i + 2; // Excel row number

        try {
          // Skip rows with empty data
          if (this.isRowEmpty(row)) {
            continue;
          }

          // Validate and extract data
          const userData = await this.processUserRow(row, rowNumber);
          if (userData) {
            users.push(userData);
          }
        } catch (error) {
          errors.push(`Baris ${rowNumber}: ${error instanceof Error ? error.message : 'Error tidak diketahui'}`);
        }
      }

      return {
        success: errors.length === 0 || users.length > 0,
        data: users,
        errors: errors.length > 0 ? errors : undefined,
        totalRows: rawData.length,
        validRows: users.length,
        processedSheets: [targetSheetName]
      };

    } catch (error) {
      console.error('Error reading Excel file:', error);
      return {
        success: false,
        errors: [`Error membaca file Excel: ${error instanceof Error ? error.message : 'Error tidak diketahui'}`],
        totalRows: 0,
        validRows: 0
      };
    }
  }

  /**
   * Validate Excel file format and structure
   * @param filePath - Path to the Excel file
   * @param sheetName - Optional sheet name to validate
   * @returns Validation result
   */
  static validateExcelFile(filePath: string, sheetName?: string): { valid: boolean; errors?: string[]; availableSheets?: string[] } {
    try {
      const workbook = xlsx.readFile(filePath);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return { valid: false, errors: ['File Excel tidak memiliki sheet'] };
      }

      console.log('Available sheets:', workbook.SheetNames);

      // Determine which sheet to validate
      let targetSheetName = sheetName;
      if (!targetSheetName) {
        // Try to find sheet with data
        for (const name of workbook.SheetNames) {
          const testWorksheet = workbook.Sheets[name];
          const testData = xlsx.utils.sheet_to_json(testWorksheet);
          if (testData && testData.length > 0) {
            console.log(`Found data in sheet: ${name}`);
            targetSheetName = name;
            break;
          }
        }

        if (!targetSheetName) {
          targetSheetName = workbook.SheetNames[0];
        }
      }

      if (!workbook.Sheets[targetSheetName]) {
        return {
          valid: false,
          errors: [`Sheet "${targetSheetName}" tidak ditemukan`],
          availableSheets: workbook.SheetNames
        };
      }

      const worksheet = workbook.Sheets[targetSheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        return {
          valid: false,
          errors: [`Sheet "${targetSheetName}" kosong`],
          availableSheets: workbook.SheetNames
        };
      }

      // Check if required columns exist
      const firstRow = data[0] as any;

      console.log(`Validation - Sheet: ${targetSheetName}`);
      console.log('Available columns:', Object.keys(firstRow));

      const hasKLP = this.extractValue(firstRow, ['KLP', 'klp', 'Klp']) !== null;
      const hasNIM = this.extractValue(firstRow, ['nm', 'NM', 'Nm', 'NIM', 'nim']) !== null;
      const hasNama = this.extractValue(firstRow, ['Nama', 'nama', 'NAMA', 'Name', 'name']) !== null;

      console.log('Column validation results:', { hasKLP, hasNIM, hasNama });

      const errors: string[] = [];
      if (!hasNIM) errors.push(`Kolom NIM tidak ditemukan di sheet "${targetSheetName}". Kolom yang tersedia: ` + Object.keys(firstRow).join(', '));
      if (!hasNama) errors.push(`Kolom Nama tidak ditemukan di sheet "${targetSheetName}". Kolom yang tersedia: ` + Object.keys(firstRow).join(', '));
      
      // KLP is optional now, just log warning
      if (!hasKLP) console.warn(`Warning: Kolom KLP tidak ditemukan di sheet "${targetSheetName}", akan menggunakan default`);

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        availableSheets: workbook.SheetNames
      };

    } catch (error) {
      console.error('Validation error:', error);
      return {
        valid: false,
        errors: [`Error validasi file: ${error instanceof Error ? error.message : 'Error tidak diketahui'}`]
      };
    }
  }

  /**
   * Get all sheets with their data preview and analysis
   */
  static analyzeAllSheets(filePath: string): { 
    sheets: Array<{ 
      name: string; 
      hasData: boolean; 
      columnCount: number; 
      rowCount: number; 
      columns: string[];
      hasValidUserData: boolean;
      missingColumns: string[];
    }> 
  } {
    try {
      const workbook = xlsx.readFile(filePath);
      const sheets = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        let hasValidUserData = false;
        let missingColumns: string[] = [];

        if (data.length > 0) {
          const firstRow = data[0] as any;
          const columns = Object.keys(firstRow);

          // Check for required columns
          const hasKLP = this.extractValue(firstRow, ['KLP', 'klp', 'Klp']) !== null;
          const hasNIM = this.extractValue(firstRow, ['nm', 'NM', 'Nm', 'NIM', 'nim']) !== null;
          const hasNama = this.extractValue(firstRow, ['Nama', 'nama', 'NAMA', 'Name', 'name']) !== null;

          hasValidUserData = hasNIM && hasNama; // KLP can be optional
          
          if (!hasKLP) missingColumns.push('KLP (optional)');
          if (!hasNIM) missingColumns.push('NIM');
          if (!hasNama) missingColumns.push('Nama');

          return {
            name: sheetName,
            hasData: data.length > 0,
            columnCount: columns.length,
            rowCount: data.length,
            columns: columns,
            hasValidUserData,
            missingColumns
          };
        }

        return {
          name: sheetName,
          hasData: false,
          columnCount: 0,
          rowCount: 0,
          columns: [],
          hasValidUserData: false,
          missingColumns: ['NIM', 'Nama', 'KLP (optional)']
        };
      });

      return { sheets };
    } catch (error) {
      console.error('Error analyzing sheets:', error);
      return { sheets: [] };
    }
  }

  /**
   * Get all sheets with their data preview (backward compatibility)
   */
  static getSheetInfo(filePath: string): { sheets: Array<{ name: string; hasData: boolean; columnCount: number; rowCount: number; columns: string[] }> } {
    try {
      const analysis = this.analyzeAllSheets(filePath);
      const sheets = analysis.sheets.map(sheet => ({
        name: sheet.name,
        hasData: sheet.hasData,
        columnCount: sheet.columnCount,
        rowCount: sheet.rowCount,
        columns: sheet.columns
      }));

      return { sheets };
    } catch (error) {
      console.error('Error getting sheet info:', error);
      return { sheets: [] };
    }
  }

  /**
   * Get preview data from Excel file
   * @param filePath - Path to the Excel file
   * @param sheetName - Optional sheet name
   * @param limit - Number of rows to preview (default: 5)
   * @returns Preview data
   */
  static getPreviewData(filePath: string, sheetName?: string, limit: number = 5) {
    try {
      const workbook = xlsx.readFile(filePath);
      
      let targetSheetName = sheetName;
      if (!targetSheetName) {
        // Auto-detect sheet with data
        for (const name of workbook.SheetNames) {
          const testWorksheet = workbook.Sheets[name];
          const testData = xlsx.utils.sheet_to_json(testWorksheet);
          if (testData && testData.length > 0) {
            targetSheetName = name;
            break;
          }
        }
        
        if (!targetSheetName) {
          targetSheetName = workbook.SheetNames[0];
        }
      }

      if (!workbook.Sheets[targetSheetName]) {
        return {
          success: false,
          error: `Sheet "${targetSheetName}" tidak ditemukan`,
          availableSheets: workbook.SheetNames
        };
      }

      const worksheet = workbook.Sheets[targetSheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      const preview = data.slice(0, limit);
      const columns = data.length > 0 ? Object.keys(data[0] as any) : [];

      return {
        success: true,
        sheetName: targetSheetName,
        totalRows: data.length,
        columns: columns,
        preview: preview,
        availableSheets: workbook.SheetNames
      };

    } catch (error) {
      console.error('Error getting preview data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if row is empty
   * @param row - Raw row data
   * @returns boolean
   */
  private static isRowEmpty(row: any): boolean {
    const values = Object.values(row);
    return values.every(value =>
      value === null ||
      value === undefined ||
      String(value).trim() === ''
    );
  }

  /**
   * Process individual row from Excel
   * @param row - Raw row data from Excel
   * @param rowNumber - Row number for error reporting
   * @returns Processed user data
   */
  private static async processUserRow(row: any, rowNumber: number): Promise<ImportedUser | null> {
    // Extract data with various possible column names
    const KLP = this.extractValue(row, ['KLP', 'klp', 'Klp']);
    const NIM = this.extractValue(row, ['nm', 'NM', 'Nm', 'NIM', 'nim']);
    const nama = this.extractValue(row, ['Nama', 'nama', 'NAMA', 'Name', 'name']);

    // Debug log
    console.log(`Row ${rowNumber} extracted:`, { KLP, NIM, nama });

    // For missing KLP, we can either use a default or extract from other data
    let finalKLP = KLP;
    if (!finalKLP || finalKLP.trim() === '') {
      // You can customize this logic based on your needs
      finalKLP = 'DEFAULT';
      
      // Option 2: Extract from NIM pattern (if you have specific naming conventions)
      // const nimStr = String(NIM || '');
      // if (nimStr.includes('2023')) finalKLP = 'TPL3BP1';
      // else if (nimStr.includes('2024')) finalKLP = 'TPL3BP2';
    }

    // Validate required fields
    if (!NIM || NIM.trim() === '') {
      throw new Error('NIM tidak boleh kosong');
    }

    if (!nama || nama.trim() === '') {
      throw new Error('Nama tidak boleh kosong');
    }

    // Clean and format data
    const cleanKLP = String(finalKLP).trim();
    const cleanNIM = String(NIM).trim();
    const cleanNama = String(nama).trim();

    // Validate NIM format - allow alphanumeric (like j0403231003)
    if (!/^[a-zA-Z0-9]+$/.test(cleanNIM)) {
      throw new Error('NIM harus berupa huruf dan angka tanpa spasi atau karakter khusus');
    }

    // Hash password using Argon2 (using NIM as password)
    const hashedPassword = await argon2.hash(cleanNIM, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });

    return {
      KLP: cleanKLP,
      NIM: cleanNIM,
      nama: cleanNama,
      password: hashedPassword
    };
  }

  /**
   * Extract value from row using multiple possible column names
   * @param row - Raw row data
   * @param possibleKeys - Array of possible column names
   * @returns Extracted value or null
   */
  private static extractValue(row: any, possibleKeys: string[]): string | null {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]).trim();
      }
    }
    return null;
  }

  /**
   * Generate Excel template for user import
   * @returns Buffer containing Excel file
   */
  static generateTemplate(): Buffer {
    try {
      // Create workbook and worksheet
      const workbook = xlsx.utils.book_new();
      
      // Sample data dengan format yang benar
      const templateData = [
        { KLP: 'TPL3BP1', NIM: 'j0403231003', Nama: 'John Doe' },
        { KLP: 'TPL3BP1', NIM: 'j0403231004', Nama: 'Jane Smith' },
        { KLP: 'TPL3BP2', NIM: 'j0403231005', Nama: 'Bob Wilson' }
      ];
      
      // Create worksheet
      const worksheet = xlsx.utils.json_to_sheet(templateData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 10 }, // KLP
        { wch: 15 }, // NIM
        { wch: 25 }  // Nama
      ];
      
      // Add worksheet to workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');
      
      // Generate buffer
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return buffer;
    } catch (error) {
      console.error('Error generating template:', error);
      throw new Error('Gagal membuat template Excel');
    }
  }

  /**
   * Get template information
   * @returns Template structure information
   */
  static getTemplateInfo() {
    return {
      requiredColumns: [
        { 
          name: 'KLP', 
          description: 'Kelas/Kelompok (contoh: TPL3BP1, TPL3BP2) - OPSIONAL', 
          required: false,
          alternatives: ['KLP', 'klp', 'Klp'],
          example: 'TPL3BP1'
        },
        { 
          name: 'NIM', 
          description: 'Nomor Induk Mahasiswa (akan digunakan sebagai username dan password)', 
          required: true,
          alternatives: ['NIM', 'nim', 'nm', 'NM', 'Nm'],
          example: 'j0403231003'
        },
        { 
          name: 'Nama', 
          description: 'Nama lengkap mahasiswa', 
          required: true,
          alternatives: ['Nama', 'nama', 'NAMA', 'Name', 'name'],
          example: 'John Doe'
        }
      ],
      notes: [
        'File harus berformat Excel (.xlsx atau .xls)',
        'Baris pertama harus berisi header kolom',
        'Password akan otomatis di-set sama dengan NIM dan di-hash dengan Argon2',
        'User yang sudah ada akan dilewati',
        'Kolom bisa menggunakan nama alternatif yang sudah didefinisikan',
        'Jika kolom KLP tidak ada, sistem akan menggunakan nilai "DEFAULT"',
        'Sistem mendukung import dari multiple sheets sekaligus',
        'Gunakan ?mode=all untuk import semua sheets',
        'Gunakan ?mode=multiple&sheets=Sheet1,Sheet2 untuk import sheets tertentu'
      ],
      sampleData: [
        { KLP: 'TPL3BP1', NIM: 'j0403231003', Nama: 'John Doe' },
        { KLP: 'TPL3BP1', NIM: 'j0403231004', Nama: 'Jane Smith' },
        { KLP: 'TPL3BP2', NIM: 'j0403231005', Nama: 'Bob Wilson' }
      ]
    };
  }
}