import swaggerJsdoc from 'swagger-jsdoc';
// import version from package.json using require
// const { version } = require('../../package.json');
const version = '1.0.0'; // manually specify version or use require if running in Node.js

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-Labs+ API Documentation',
      version: version || '1.0.0',
      description: 'API Documentation untuk sistem peminjaman laboratorium IPB University',
      contact: {
        name: 'E-Labs+ Team',
        email: 'admin@elabs.takumifahri.my.id',
        url: 'https://elabs.takumifahri.my.id'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server'
      },
      {
        url: 'https://elabs-api.takumifahri.my.id',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT stored in HTTP-only cookie'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nama: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            NIM: { type: 'string', example: 'J0403231001' },
            NIP: { type: 'string', example: '198901012020121001' },
            role: { type: 'string', example: 'mahasiswa' },
            isActive: { type: 'boolean', example: true },
            isBlocked: { type: 'boolean', example: false }
          }
        },
        Ruangan: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            kode_ruangan: { type: 'string', example: 'LK-01' },
            nama_ruangan: { type: 'string', example: 'Lab Komputer 1' },
            gedung: { type: 'string', example: 'Gedung A' },
            status: { type: 'string', enum: ['KOSONG', 'DIPAKAI', 'DIPERBAIKI', 'DIAJUKAN'], example: 'KOSONG' }
          }
        },
        Barang: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            kode_barang: { type: 'string', example: 'BRG-001' },
            nama_barang: { type: 'string', example: 'Laptop Dell' },
            merek: { type: 'string', example: 'Dell' },
            kondisi: { type: 'string', enum: ['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT'], example: 'BAIK' },
            status: { type: 'string', enum: ['TERSEDIA', 'DIPINJAM', 'RUSAK', 'PERBAIKAN'], example: 'TERSEDIA' },
            jumlah: { type: 'integer', example: 10 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            error: { type: 'string', example: 'Detailed error description' }
          }
        }
      }
    },
    tags: [
      { name: 'Authentication', description: 'Auth endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Ruangan', description: 'Room management' },
      { name: 'Barang', description: 'Item management' },
      { name: 'Peminjaman Ruangan', description: 'Room booking' },
      { name: 'Peminjaman Barang', description: 'Item borrowing' },
      { name: 'Admin', description: 'Admin operations' }
    ]
  },
  apis: [
    './src/code/routes/**/*.ts',
    './src/code/controller/**/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);