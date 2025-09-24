import { Request, Response, NextFunction } from "express";
import { verifyJWTToken } from "../utils/hash";
import { isBlacklisted } from "../utils/jwt";

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];

    if (isBlacklisted(token)) {
        return res.status(401).json({ message: 'Token revoked' });
    }

    try {
        const decoded = await verifyJWTToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        
        // Set user data from JWT payload
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

function Checkroles(requiredRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        console.log('user: ', user)
        console.log('Roles User:', user.nama_role)
        if (!user || !user.nama_role) {
            return res.status(403).json({ message: 'Forbidden - No role found' });
        }
        
        if (requiredRoles.includes(user.nama_role)) {
            return next();
        }
        
        return res.status(403).json({ message: 'Unauthorized - Access denied' });
    };
}

const AuthMiddleware = {
    authMiddleware,
    Checkroles
}

export default AuthMiddleware;