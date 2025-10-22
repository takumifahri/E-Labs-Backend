// export interface TipeRuangan {
//     id: number;
//     nama_tipe: string;
//     createdAt: Date;
//     updatedAt: Date;
//     deletedAt?: Date;
// }
export enum StatusRuangan {
    DIPAKAI = "DIPAKAI",
    KOSONG = "KOSONG",
    DIPERBAIKI = "DIPERBAIKI"
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

export interface PengajuanRuanganaTerjadwalRequest {
    gedung: string;
    nim?: string;
    nip?: string;
    ruangan_id: number;
    waktu_mulai: Date;
    waktu_selesai: Date;
    dokumen?: string;
    kegiatan?: string;

}

