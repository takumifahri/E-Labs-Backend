// export interface TipeRuangan {
//     id: number;
//     nama_tipe: string;
//     createdAt: Date;
//     updatedAt: Date;
//     deletedAt?: Date;
// }

export interface Ruangan {
    id: number;
    gedung: string;
    nama_ruangan: string;
    kode_ruangan: string;

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
