type Roles = {
    ADMIN: 'admin';
    USER: 'user';
}

export interface User {
    id: string;
    name: string;
    email: string;
    password: string;
    isActive: boolean;
    role: Roles[keyof Roles];
    createdAt: Date;
    updatedAt: Date;
}