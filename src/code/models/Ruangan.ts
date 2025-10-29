// export interface TipeRuangan {
//     id: number;
//     nama_tipe: string;
//     createdAt: Date;
//     updatedAt: Date;
//     deletedAt?: Date;
// }
export enum StatusRuangan {
    DIAJUKAN = "DIAJUKAN",
    DIPAKAI = "DIPAKAI",
    KOSONG = "KOSONG",
    DIPERBAIKI = "DIPERBAIKI"
}
export enum PeminjamanRuanganStatus {
    DIAJUKAN = "DIAJUKAN",
    DISETUJUI = "DISETUJUI",
    DITOLAK = "DITOLAK",
    DIBATALKAN = "DIBATALKAN",
    SELESAI = "SELESAI",
    BERLANGSUNG = "BERLANGSUNG"
}

export interface Ruangan {
    id: number;
    gedung: string;
    nama_ruangan: string;
    kode_ruangan: string;
    status: StatusRuangan;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface CreateRuanganRequest {
    gedung: string;
    nama_ruangan: string;
    kode_ruangan: string;
}

export interface UpdateRuanganRequest {
    id: number;
    gedung?: string;
    nama_ruangan?: string;
    kode_ruangan?: string;
}

export interface PengajuanPeminjamanRuanganBaseRequest{
    nim?: string;
    ruangan_id?: number;
}

export interface LengkapiDataPengajuanRuanganRequest {
    id: number;
    matkul_id?: number;
    waktu_mulai: Date;
    waktu_selesai: Date;
    dokumen?: string;
    kegiatan?: string;
}

export interface PengajuanRuanganaTerjadwalRequest {
    gedung: string;
    nim?: string;
    nip?: string;
    matkul_id?: number;
    ruangan_id: number;
    waktu_mulai: Date;
    waktu_selesai: Date;
    dokumen?: string;
    kegiatan?: string;
}

export interface pembatalanPeminjamanRuanganTerjadwalRequest {
    id: number;
    nim?: string;
    nip?: string;
    status: PeminjamanRuanganStatus;
}
export interface ListPengajuanPeminjamanRuanganResponse {
    id: number;
    ruangan_id: number;
    user_id: number;
    jam_mulai: Date;
    jam_selesai: Date;
    status: PeminjamanRuanganStatus;
    kegiatan: string;
    tanggal: Date;
    dokumen: string | null;
    createdAt: Date;
    updatedAt: Date;
    responded_by: number | null;
    responden: {
        id: number;
        nama: string;
        email: string;
        role: string;
    } | null;
    user: {
        id: number;
        nama: string;
        email: string;
        NIM: string | null;
        NIP: string | null;
        role: string;
    } | null;

    
}