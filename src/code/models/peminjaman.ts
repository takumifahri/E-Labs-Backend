export interface PeminjamanItem {
    id: number;
    user_id: number;
    barang_id: number;
    estimasi_pinjam: Date;
    jam_kembali?: Date;
    jam_pinjam: Date;
    kode_peminjaman: string;
    tanggal_pinjam: Date;
    tanggal_kembali?: Date;
    status: string;
    kegiatan: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    
    // Relations (optional)
    user?: {
        id: number;
        nama: string;
        email: string;
        uniqueId: string;
    };
    barang?: {
        id: number;
        nama_barang: string;
        kode_barang: string;
        kategori?: {
            nama_kategori: string;
        };
    };
}

export interface PeminjamanHandset {
    id: number;
    user_id: number;
    barang_id: number;
    peminjaman_handset_id?: number; // Self reference atau referensi lain
    kode_peminjaman: string;
    tanggal_pinjam: Date;
    tanggal_kembali?: Date;
    status: string;
    kegiatan: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    
    // Relations (optional)
    user?: {
        id: number;
        nama: string;
        email: string;
        uniqueId: string;
    };
    barang?: {
        id: number;
        nama_barang: string;
        kode_barang: string;
        kategori?: {
            nama_kategori: string;
        };
    };
    peminjaman_ruangan?: PeminjamanRuangan[];
}

export interface PeminjamanRuangan {
    id: number;
    ruangan_id: number;
    user_id: number;
    peminjaman_handset_id?: number;
    tanggal: Date; // Note: field name is 'tanggal', not 'tanggal_pinjam'
    jam_mulai: Date; // Note: DateTime in schema
    jam_selesai: Date; // Note: DateTime in schema
    status: string;
    kegiatan: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    
    // Relations (optional)
    ruangan?: {
        id: number;
        nama_ruangan: string;
        kode_ruangan: string;
        gedung: string;
    };
    user?: {
        id: number;
        nama: string;
        email: string;
        uniqueId: string;
    };
    peminjaman_handset?: PeminjamanHandset;
}

// Request interfaces for Peminjaman Item
export interface CreatePeminjamanItemRequest {
    barang_id: number;
    estimasi_pinjam: Date;
    jam_pinjam: Date;
    tanggal_pinjam: Date;
    tanggal_kembali?: Date;
    kegiatan: string;
}

export interface UpdatePeminjamanItemRequest {
    estimasi_pinjam?: Date;
    jam_kembali?: Date;
    jam_pinjam?: Date;
    tanggal_kembali?: Date;
    status?: 'Dipinjam' | 'Dikembalikan' | 'Terlambat' | 'Rusak';
    kegiatan?: string;
}

// Request interfaces for Peminjaman Handset
export interface CreatePeminjamanHandsetRequest {
    barang_id: number;
    peminjaman_handset_id?: number;
    tanggal_pinjam: Date;
    tanggal_kembali?: Date;
    kegiatan: string;
}

export interface UpdatePeminjamanHandsetRequest {
    tanggal_kembali?: Date;
    status?: 'Dipinjam' | 'Dikembalikan' | 'Terlambat' | 'Rusak';
    kegiatan?: string;
}

// Request interfaces for Peminjaman Ruangan
export interface CreatePeminjamanRuanganRequest {
    ruangan_id: number;
    peminjaman_handset_id?: number;
    tanggal: Date;
    jam_mulai: Date;
    jam_selesai: Date;
    kegiatan: string;
}

export interface UpdatePeminjamanRuanganRequest {
    tanggal?: Date;
    jam_mulai?: Date;
    jam_selesai?: Date;
    status?: 'Disetujui' | 'Ditolak' | 'Pending' | 'Selesai' | 'Dibatalkan';
    kegiatan?: string;
}

// Response interfaces
export interface PeminjamanItemResponse {
    id: number;
    kode_peminjaman: string;
    user: {
        nama: string;
        email: string;
        uniqueId: string;
    };
    barang: {
        nama_barang: string;
        kode_barang: string;
        kategori: string;
    };
    estimasi_pinjam: Date;
    jam_kembali?: Date;
    jam_pinjam: Date;
    tanggal_pinjam: Date;
    tanggal_kembali?: Date;
    status: string;
    kegiatan: string;
    createdAt: Date;
}

export interface PeminjamanHandsetResponse {
    id: number;
    kode_peminjaman: string;
    user: {
        nama: string;
        email: string;
        uniqueId: string;
    };
    barang: {
        nama_barang: string;
        kode_barang: string;
        kategori: string;
    };
    tanggal_pinjam: Date;
    tanggal_kembali?: Date;
    status: string;
    kegiatan: string;
    createdAt: Date;
}

export interface PeminjamanRuanganResponse {
    id: number;
    user: {
        nama: string;
        email: string;
        uniqueId: string;
    };
    ruangan: {
        nama_ruangan: string;
        kode_ruangan: string;
        gedung: string;
    };
    tanggal: Date;
    jam_mulai: Date;
    jam_selesai: Date;
    status: string;
    kegiatan: string;
    peminjaman_handset?: {
        kode_peminjaman: string;
        barang: {
            nama_barang: string;
            kode_barang: string;
        };
    };
    createdAt: Date;
}

// Enum for status
export enum PeminjamanStatus {
    // Item & Handset status
    DIPINJAM = 'Dipinjam',
    DIKEMBALIKAN = 'Dikembalikan',
    TERLAMBAT = 'Terlambat',
    RUSAK = 'Rusak',
    
    // Ruangan status
    PENDING = 'Pending',
    DISETUJUI = 'Disetujui',
    DITOLAK = 'Ditolak',
    SELESAI = 'Selesai',
    DIBATALKAN = 'Dibatalkan'
}