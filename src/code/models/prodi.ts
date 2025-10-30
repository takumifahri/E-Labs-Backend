import { MatkulResponse } from "./matkul";

export interface MasterProdi {
    id: number;
    nama_prodi: string;
    kode_prodi: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    matkul?: MatkulResponse[];
}

export interface CreateProdiRequest {
    nama_prodi: string;
    kode_prodi: string;
}

export interface UpdateProdiRequest {
    id: number;
    nama_prodi?: string;
    kode_prodi?: string;
}
