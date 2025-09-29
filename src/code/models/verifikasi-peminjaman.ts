import { StatusPeminjamanItem, StatusPeminjamanHandset, Barang } from '@prisma/client';

export interface VerifikasiRequest {
    id_peminjaman?: number;
    status: StatusPeminjamanHandset;
    catatan?: string;
    items?: VerifikasiPeminjamanRequest[];
}

export interface VerifikasiPeminjamanRequest {
    status: StatusPeminjamanItem;
}
export interface VerifikasiPeminjamanItemRequest {
    status: StatusPeminjamanItem;
}
export interface VerifikasiPeminjamanResponse {
    id: number;
    id_peminjaman: number;
    status: StatusPeminjamanItem;
    item: VerifikasiPeminjamanItemRequest[];
}

export interface GetAllPengajuan{
    id: number;
    kode_peminjaman: string;
    pengaju: number;
    status: StatusPeminjamanHandset;
    tgl_pinjam: Date;
    dalam_rangka: string;
    dokumen: string;
    item: any[];
}

export interface GetAllItemAjuan{
    id: number;
    handset_id: number;
    barang: Barang;
    jumlah: number;
    estimasi_pinjam: Date;
    status: StatusPeminjamanItem;
}