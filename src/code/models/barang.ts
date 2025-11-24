export enum KondisiBarang {
    BAIK = 'BAIK',
    RUSAK_RINGAN = 'RUSAK_RINGAN',
    RUSAK_BERAT = 'RUSAK_BERAT',
    HILANG = 'HILANG'
}

export enum StatusBarang {
    TERSEDIA = 'TERSEDIA',
    DIPINJAM = 'DIPINJAM',
    PERBAIKAN = 'PERBAIKAN',
    TIDAK_TERSEDIA = 'TIDAK_TERSEDIA'
}


export interface Kategori_Barang {
    id: number;
    nama_kategori: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface Barang {
    id: Number;
    kode_barang: string;
    nama_barang: string;
    merek: string;
    kondisi: KondisiBarang;
    jumlah: number;
    status: StatusBarang;
    kategori_id: number;
    kategori: Kategori_Barang;
    foto_barang?: string;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface BarangRespone {
    id: Number;
    kode_barang: string;
    nama_barang: string;
    merek: string;
    jumlah: number;
    kondisi: KondisiBarang;
    status: StatusBarang;
    kategori: Kategori_Barang;
    foto_barang?: string;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface BarangRequest {
    id: Number;
    kode_barang: string;
    nama_barang: string;
    merek: string;
    kondisi: KondisiBarang;
    status: StatusBarang;
    kategori_id: number;
    kategori: Kategori_Barang;
    foto_barang?: string;
    jumlah: number;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

// enum StatusPeminjamanItem {
//   DITOLAK
//   DIAJUKAN
//   DIPINJAM
//   DIKEMBALIKAN
//   TERLAMBAT
// }

// enum StatusPeminjamanHandset {
//   DIAJUKAN
//   DISETUJUI
//   SEBAGIAN_DISETUJUI
//   DITOLAK
//   DIBATALKAN
//   SELESAI
//   DIPINJAM
// }

export interface PeminjamanBarangItemRequest {
    // item
    barang_id: number;
    jumlah: number;
    kegiatan?: string;

    // samakan aja tanggal pinjam dan jam pinajm nya dnegan handset
    tanggal_pinjam: Date;
    tanggal_kembali: Date;
    estimasi_pinjam?: Date;
    jam_pinjam?: string;
    jam_kembali?: string;
    kode_peminjaman?: string;
}

export interface PeminjamanBarangRequest {
    // Handset
    ID_Peminjam?: string;
    items: PeminjamanBarangItemRequest[];
    tanggal_pinjam: Date;
    tanggal_kembali: Date;
    tujuan_peminjaman: string;
    dokumen_pendukung?: string;
}


export interface ListPeminjamanBarangResponse {
    id: number;
    kode_peminjaman: string;
    ID_Peminjam: string;
    nama_peminjam: string;
    tanggal_pinjam: Date;
    tanggal_kembali: Date;
    tujuan_peminjaman: string;
    dokumen_pendukung?: string;
    status_peminjaman: string;

    isReturned?: boolean;
    isReturnedLate?: boolean;
    
    barang_dipinjam: {
        kode_peminjaman_item: string;
        nama_barang: string;
        jumlah: number;
        kegiatan: string;
        status_item: string;
    }[];


    createdAt: Date;
    updatedAt: Date;
}
