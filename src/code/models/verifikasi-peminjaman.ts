import { StatusPeminjamanItem, StatusPeminjamanHandset, Barang } from '@prisma/client';
import { User } from './user';

// Di file models/verifikasi-peminjaman.ts
export interface VerifikasiRequest {
    id_peminjaman?: number;
    status?: StatusPeminjamanHandset; // Optional untuk bulk action
    catatan?: string;
    items: VerifikasiPeminjamanItemRequest[]; // Required untuk per-item action
}

export interface VerifikasiPeminjamanItemRequest {
    id: number; // ID item peminjaman
    status: StatusPeminjamanItem;
    catatan?: string;
}
export interface VerifikasiPeminjamanRequest {
    status: StatusPeminjamanItem;
}

export interface VerifikasiPeminjamanResponse {
    id: number;
    id_peminjaman: number;
    status: StatusPeminjamanItem;
    item: VerifikasiPeminjamanItemRequest[];
}
export interface PengajuData {
    id: number;
    NIM: string | null;
    nama: string;
    email: string;
    role: {
        nama_role: string;
    };
}

export interface GetAllPengajuan{
    id: number;
    kode_peminjaman: string;
    pengaju: PengajuData;
    status: StatusPeminjamanHandset;
    tgl_pinjam: Date;
    respon_by: string | 'PENDING';
    dalam_rangka: string;
    dokumen: string;
    item: any[];
    Detail_Barang: BarangDetailResponseVerfikasi;
}

export interface GetAllItemAjuan{
    id: number;
    handset_id: number;
    barang: Barang;
    jumlah: number;
    estimasi_pinjam: Date;
    status: StatusPeminjamanItem;
}

export interface GetDetailPengajuan {
    id: number;
    kode_peminjaman: string;
    pengaju: PengajuData;
    status: StatusPeminjamanHandset;
    tgl_pinjam: Date;
    dalam_rangka: string;
    dokumen: string;
    item: any[];
}

export interface BarangDetailResponseVerfikasi {
    Yang_Disetujui: {
        id: number;
        barang: Barang;
        jumlah: number;
        kondisi_pinjam: string;
    };   
    Yang_Ditolak: {
        id: number;
        barang: Barang;
        jumlah: number;
        kondisi_pinjam: string;
    };
}