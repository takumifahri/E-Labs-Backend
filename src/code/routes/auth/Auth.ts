import express from 'express';
import AuthController from '../../controller/api/auth/Authcontroller';
import ProfileController from '../../controller/api/auth/profileController';
import AuthMiddleware from '../../middleware/authmiddleware';

const authRouter = express.Router();

// Public routes
authRouter.post('/register', AuthController.Register);
authRouter.post('/login', AuthController.Login);
authRouter.post('/logout', AuthController.Logout);

// Protected routes (require authentication)
authRouter.get('/me', AuthMiddleware.authMiddleware, ProfileController.WhoAmI);
authRouter.put('/profile', AuthMiddleware.authMiddleware, ProfileController.UpdateProfile);
authRouter.put('/change-password', AuthMiddleware.authMiddleware, ProfileController.ChangePassword);

export default authRouter;