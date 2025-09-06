export interface TipeRuangan {
    id: number;
    nama_tipe: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface Ruangan {
    id: number;
    kode_ruangan: string;
    nama_ruangan: string;
    kapasitas: number;
    lokasi: string;
    tipeRuanganId: number;
    tipeRuangan: TipeRuangan;
    kapasistas: number;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface CreateRuanganRequest {
    id : number;
    kode_ruangan: string;
    nama_ruangan: string;
    kapasitas: number;
    lokasi: string;
    tipeRuanganId: number;
}

export interface UpdateRuanganRequest {
    id: number;
    kode_ruangan?: string;
    nama_ruangan?: string;
    kapasitas?: number;
    lokasi?: string;
    tipeRuanganId?: number;

    updatedAt: Date;
    deletedAt?: Date;
    
}