export interface prodi {
    id: number;
    nama_prodi: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface CreateProdiRequest {
    nama_prodi: string;
}