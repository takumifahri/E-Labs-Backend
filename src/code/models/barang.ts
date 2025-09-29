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
