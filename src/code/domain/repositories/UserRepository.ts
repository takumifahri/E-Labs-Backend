import { User } from "../entities/users";

export interface UserRepository {
    createUser(user: Omit<User, 'id'>): Promise<User>;
    findUserById(id: string): Promise<User | null>;
}