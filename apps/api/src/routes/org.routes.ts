import { Router } from 'express';
import { UpdateOrganizationInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAuth, requireOwner } from '../middleware/auth';
import * as orgService from '../services/org.service';

export const orgRoutes = Router();
orgRoutes.use(requireAuth);

// The signed-in user's organisation.
orgRoutes.get('/', async (req, res) => {
  res.json(await orgService.getOrganization(currentUser(req)));
});

orgRoutes.patch('/', requireOwner, validateBody(UpdateOrganizationInput), async (req, res) => {
  res.json(await orgService.renameOrganization(currentUser(req), req.body.name));
});
