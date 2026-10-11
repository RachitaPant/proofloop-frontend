import { Router, type Request } from 'express';
import { CreateDelegationInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import * as delegationService from '../services/delegation.service';

export const delegationRoutes = Router();
delegationRoutes.use(requireAuth);

// Delegations I've given and received.
delegationRoutes.get('/', async (req, res) => {
  res.json(await delegationService.listMyDelegations(currentUser(req)));
});

delegationRoutes.post('/', validateBody(CreateDelegationInput), async (req, res) => {
  res.status(201).json(await delegationService.createDelegation(currentUser(req), req.body));
});

// Ends a delegation early (soft delete: kept for the record).
delegationRoutes.delete('/:id', async (req: Request<{ id: string }>, res) => {
  res.json(await delegationService.revokeDelegation(currentUser(req), req.params.id));
});
