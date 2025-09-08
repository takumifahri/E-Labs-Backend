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
    kondisi: string;
    status: string;
    kategori_id: number;
    kategori: Kategori_Barang;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}