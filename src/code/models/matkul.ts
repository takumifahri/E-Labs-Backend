export interface CreateMatkulRequest {
    prodi_id: number;
    matkul: string;
    semester?: number;
}

export interface UpdateMatkulRequest {
    prodi_id?: number;
    matkul?: string;
    semester?: number;
}

export interface MatkulResponse {
    id: number;
    prodi_id: number;
    matkul: string;
    semester?: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    prodi?: {
        id: number;
        nama_prodi: string;
        kode_prodi: string;
    };
}