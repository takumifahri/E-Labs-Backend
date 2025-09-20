import express from 'express';
import AuthController from '../../controller/auth/Authcontroller';
import ProfileController from '../../controller/auth/profileController';
import AuthMiddleware from '../../middleware/authmiddleware';

const authRouter = express.Router();

// Public routes
authRouter.post('/register', AuthController.Register);
authRouter.post('/login', AuthController.Login);
authRouter.post('/logout', AuthController.Logout);

// Protected routes (require authentication)
authRouter.get('/me', AuthMiddleware.authMiddleware, ProfileController.WhoAmI);
authRouter.put('/profile', AuthMiddleware.authMiddleware, ProfileController.UpdateProfile);
authRouter.patch('/change-password', AuthMiddleware.authMiddleware, ProfileController.ChangePassword);

export default authRouter;