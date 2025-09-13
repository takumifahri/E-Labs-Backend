export enum PeminjamanHeaderStatus {
    PENDING = 'Diajukan',
    DISETUJUI = 'Disetujui',
    DITOLAK = 'Ditolak',
    SELESAI = 'Selesai',
    DIBATALKAN = 'Dibatalkan',
    DIPINJAM = 'Dipinjam',
}

export enum PeminjamanItemStatus {
    DIPINJAM = 'Dipinjam',
    DIKEMBALIKAN = 'Dikembalikan',
    TERLAMBAT = 'Terlambat',
}

export interface PeminjamanHeader {
    id: number;
    kode_peminjaman: string;
    user_id: number;
    tanggal_pinjam: Date;
    tanggal_kembali?: Date | null;
    keperluan?: string | null;
    status: PeminjamanHeaderStatus;
    peminjam_nama?: string | null;
    peminjaman_item: PeminjamanItem[];
    estimasi_pinjam?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
}
export interface PeminjamanItem {
    id: number;
    peminjaman_id: number; // foreign key -> header
    barang_id: number;
    jumlah?: number | null;
    jam_pinjam?: Date | null;
    jam_kembali?: Date | null;
    estimasi_pinjam?: Date | null;
    kondisi_pinjam?: string | null;
    kondisi_kembali?: string | null;
    status: PeminjamanItemStatus;
    kegiatan?: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
}

// Peminjaman Headers dan Items Request
export interface AjuanPeminjamanRequest {
    tanggal_pinjam: Date;
    tanggal_kembali?: Date;
    keperluan?: string;
    peminjam_nama?: string;
    estimasi_pinjam?: Date;
    items: AjuanPeminjamanItemRequest[];
}

export interface AjuanPeminjamanItemRequest {
    barang_id: number;
    jumlah?: number;
    jam_pinjam?: Date;
    jam_kembali?: Date;
    estimasi_pinjam?: Date;
    kondisi_pinjam?: string; // Changed from PeminjamanItemStatus to string
    kegiatan?: string;
}
// Response Interfaces
export interface PeminjamanHeaderResponse {
    id: number;
    kode_peminjaman: string;
    user: {
        id: number;
        NIM: string;
        nama: string;
        email: string;
    };
    tanggal_pinjam: Date;
    tanggal_kembali?: Date | null;
    keperluan?: string | null;
    estimasi_pinjam?: Date | null;
    status: PeminjamanHeaderStatus;
    peminjam_nama?: string | null;
    peminjaman_item: PeminjamanItemResponse[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
}

export interface PeminjamanItemResponse {
    id: number;
    peminjaman_id: number; // foreign key -> header
    barang: {
        id: number;
        nama: string;
        jenis: string;
        kondisi: string;
    };
    jumlah?: number | null;
    jam_pinjam: Date | null;
    jam_kembali: Date | null;
    estimasi_pinjam?: Date | null;
    status: PeminjamanItemStatus;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
}