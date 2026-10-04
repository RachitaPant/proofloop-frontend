import type { UserDoc } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. Use currentUser(req) in handlers instead of reading this directly. */
      user?: UserDoc;
    }
  }
}

export {};
