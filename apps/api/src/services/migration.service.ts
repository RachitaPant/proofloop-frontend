import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Workflow } from '../models/Workflow';
import { Request } from '../models/Request';
import { Delegation } from '../models/Delegation';
import { ApproverGroup } from '../models/ApproverGroup';

const NO_ORG = { orgId: { $in: [null, ''] } };

/**
 * Data created before organisations existed has no orgId. This moves all of
 * it into one default organisation (and makes its earliest admin the owner),
 * so nothing is lost and nothing is visible to anyone outside that
 * organisation. Idempotent: once nothing lacks an orgId it does nothing, so
 * it is cheap to run on every cold start.
 */
export async function migrateToOrganizations() {
  if (!(await User.exists(NO_ORG))) return;

  // The partial unique index on isDefault makes concurrent cold starts agree
  // on a single default organisation.
  const org = await Organization.findOneAndUpdate(
    { isDefault: true },
    { $setOnInsert: { name: 'ProofLoop Demo', isDefault: true } },
    { upsert: true, new: true },
  );
  const orgId = org.id as string;

  await Promise.all(
    [User, Workflow, Request, Delegation, ApproverGroup].map((model) =>
      (model as typeof User).updateMany(NO_ORG, { $set: { orgId } }),
    ),
  );

  if (!(await User.exists({ orgId, isOwner: true }))) {
    const owner = await User.findOne({ orgId, role: 'ADMIN' }).sort({ createdAt: 1 });
    if (owner) {
      owner.isOwner = true;
      await owner.save();
      await Organization.updateOne({ _id: orgId }, { $set: { createdBy: owner.id } });
    }
  }
  console.log(`Moved pre-organisation data into "${org.name}".`);
}
