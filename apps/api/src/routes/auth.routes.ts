import { Router } from 'express';
import { LoginInput, RegisterInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import * as authService from '../services/auth.service';

export const authRoutes = Router();

authRoutes.post('/register', validateBody(RegisterInput), async (req, res) => {
  res.json(await authService.register(req.body));
});

authRoutes.post('/login', validateBody(LoginInput), async (req, res) => {
  res.json(await authService.login(req.body));
});
