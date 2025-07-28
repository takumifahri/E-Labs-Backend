export type roles = {
    ADMIN: 'admin';
    USER: 'user';
}

export interface User {
    id: string;
    uniqueId: string;
    name: string;
    email: string;
    password: string;
    isActive: boolean;
    role: roles[keyof roles];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserRequest {
    name: string;
    email: string;
    password: string;
    role: roles[keyof roles];
}   

export interface UpdateUserRequest {
    name?: string;
    email?: string;
    role?: roles[keyof roles];
    address?: string;
    phone?: string;
}

export interface UserResponse {
    uniqueId: string;
    name: string;
    email: string;
    roles: roles[keyof roles];
    createdAt: Date;
    updatedAt: Date;
}
