import jwt from 'jsonwebtoken';
import argon2 from 'argon2';

const jwtBlacklist = new Set<string>();
export function addToBlacklist(token: string) {
    jwtBlacklist.add(token);
}

export function isBlacklisted(token: string): boolean {
    return jwtBlacklist.has(token);
}