export interface ProfileDto {
    id: number;
    uniqueId: string;
    roleId: number;
    semester?: number;
    profil?: string;
    email: string;
    nama: string;
    NIM?: string;
    NIP?: string;
    isActive: boolean;
    role?: {
        id: number;
        nama_role: string;
        deskripsi: string;
    };
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface CreateProfileDto {
    roleId?: number;
    semester?: number;
    profil?: string;
    email: string;
    nama: string;
    NIM?: string;
    NIP?: string;
    password: string;
}

export interface UpdateProfileDto {
    semester?: number;
    profil?: string;
    email?: string;
    nama?: string;
    NIM?: string;
    NIP?: string;
}

export interface ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}