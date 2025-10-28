import { Request, Response, NextFunction } from "express";
import { verifyJWTToken } from "../utils/hash";
import { isBlacklisted } from "../utils/jwt";

// Middleware untuk membaca token dari HTTP Only cookie atau Authorization header
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // Cek token di cookie dulu, jika tidak ada baru cek di header
    const token = req.cookies?.token || (
        req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null
    );

    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'No token provided',
            debug: 'authMiddleware: Missing token in cookie and header'
        });
    }

    if (isBlacklisted(token)) {
        return res.status(401).json({ 
            success: false,
            message: 'Token revoked',
            debug: 'authMiddleware: Token is blacklisted'
        });
    }

    try {
        const decoded = await verifyJWTToken(token);
        if (!decoded) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token',
                debug: 'authMiddleware: Token verification failed'
            });
        }
        
        // Set user data from JWT payload
        req.user = decoded;
        next();
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        return res.status(401).json({ 
            success: false,
            message: 'Unauthorized',
            debug: 'authMiddleware: Token processing error'
        });
    }
}

function Checkroles(requiredRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        
        // Enhanced debugging
        if (process.env.NODE_ENV === 'development') {
            console.log('🛡️  Checkroles middleware executing:', {
                user_role: user?.nama_role,
                required_roles: requiredRoles,
                user_data: user ? {
                    id: user.id,
                    uniqueId: user.uniqueId,
                    email: user.email,
                    roleId: user.roleId
                } : null
            });
        }
        
        if (!user || !user.nama_role) {
            console.log('❌ Checkroles: No user or role found');
            return res.status(403).json({ 
                success: false,
                message: 'Forbidden - No role found',
                debug: 'Checkroles: User object or nama_role missing'
            });
        }
        
        if (requiredRoles.includes(user.nama_role)) {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ Checkroles: Access granted for role:', user.nama_role);
            }
            return next();
        }
        
        console.log('❌ Checkroles: Access denied for role:', user.nama_role);
        return res.status(403).json({ 
            success: false,
            message: 'Unauthorized - Access denied',
            debug: `Checkroles: Role '${user.nama_role}' not in required roles: [${requiredRoles.join(', ')}]`
        });
    };
}

const AuthMiddleware = {
    authMiddleware,
    Checkroles
}

export default AuthMiddleware;