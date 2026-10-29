import type { ApproverGroupInput } from '@proofloop/shared';
import { ApproverGroup, type ApproverGroupDoc } from '../models/ApproverGroup';
import { Workflow } from '../models/Workflow';
import { User, type UserDoc } from '../models/User';
import { ConflictException, ResourceNotFoundException, ValidationException } from '../utils/errors';

/** Groups with member names resolved, in one user query for the whole list. */
async function withMembers(groups: ApproverGroupDoc[]) {
  const ids = [...new Set(groups.flatMap((g) => g.memberIds))];
  const users = ids.length ? await User.find({ _id: { $in: ids } }) : [];
  const byId = new Map(users.map((u) => [u.id as string, u]));
  return groups.map((g) => ({
    ...g.toJSON(),
    members: g.memberIds.flatMap((id) => {
      const u = byId.get(id);
      return u ? [{ id, name: u.name, email: u.email }] : [];
    }),
  }));
}

/** Any signed-in user can see groups (the workflow builder needs them). */
export async function listGroups(user: UserDoc) {
  return withMembers(await ApproverGroup.find({ orgId: user.orgId }).sort({ name: 1 }));
}

async function checkMembers(orgId: string, memberIds: string[]) {
  const unique = [...new Set(memberIds)];
  const found = await User.countDocuments({ orgId, _id: { $in: unique } });
  if (found !== unique.length) throw new ValidationException({ memberIds: 'Some members are not existing users' });
  return unique;
}

async function checkNameFree(orgId: string, name: string, exceptId?: string) {
  const clash = await ApproverGroup.findOne({ orgId, name }).collation({ locale: 'en', strength: 2 });
  if (clash && clash.id !== exceptId) throw new ConflictException(`A group named "${name}" already exists`);
}

export async function createGroup(admin: UserDoc, { name, description, memberIds }: ApproverGroupInput) {
  await checkNameFree(admin.orgId, name);
  const group = await ApproverGroup.create({
    orgId: admin.orgId,
    name,
    description,
    memberIds: await checkMembers(admin.orgId, memberIds),
    createdBy: admin.id,
  });
  return (await withMembers([group]))[0];
}

export async function updateGroup(admin: UserDoc, id: string, { name, description, memberIds }: ApproverGroupInput) {
  const group = await ApproverGroup.findOne({ _id: id, orgId: admin.orgId }).catch(() => null);
  if (!group) throw new ResourceNotFoundException('Approver group not found');
  await checkNameFree(admin.orgId, name, group.id);

  group.name = name;
  group.description = description;
  group.memberIds = await checkMembers(admin.orgId, memberIds);
  await group.save();

  // Workflows show the group's name; keep it current.
  await Workflow.updateMany(
    { orgId: admin.orgId, 'steps.approverGroupId': group.id },
    { $set: { 'steps.$[step].approverGroupName': name } },
    { arrayFilters: [{ 'step.approverGroupId': group.id }] },
  );
  return (await withMembers([group]))[0];
}

/** Refused while any workflow still routes steps to the group. */
export async function deleteGroup(admin: UserDoc, id: string) {
  const group = await ApproverGroup.findOne({ _id: id, orgId: admin.orgId }).catch(() => null);
  if (!group) throw new ResourceNotFoundException('Approver group not found');
  const inUse = await Workflow.countDocuments({ orgId: admin.orgId, 'steps.approverGroupId': group.id });
  if (inUse > 0) {
    throw new ConflictException(`This group is used by ${inUse} workflow(s); delete or change those first`);
  }
  await group.deleteOne();
}
