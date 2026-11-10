/**
 * Who can see what. One rule for documents, logins, bank accounts, cards and
 * notes, so privacy can never drift between them.
 *
 * 1. Deleted items are hidden (they live in Recently deleted).
 * 2. "Only me" items are visible only to the member who saved them.
 * 3. Common items (no owner) are visible to everyone.
 * 4. A profile-only member's items are visible to the whole family that manages them.
 * 5. Otherwise, personal items follow the family setting: shared with everyone,
 *    or visible only to their owner.
 */
import type { Family, ID, Member, Ownable } from './types';

export function findMember(family: Family, id: ID | undefined): Member | undefined {
  return id ? family.members.find((m) => m.id === id) : undefined;
}

export function canSee(family: Family, viewerId: ID, item: Ownable): boolean {
  if (item.deletedAt) return false;
  if (item.onlyMe) return item.createdBy === viewerId;
  if (!item.ownerId) return true;
  if (item.ownerId === viewerId) return true;
  const owner = findMember(family, item.ownerId);
  if (!owner) return true; // orphaned items stay visible rather than vanish
  if (owner.kind === 'profile') return true;
  return family.personalSharing === 'family';
}

export function visibleTo<T extends Ownable>(family: Family, viewerId: ID, items: readonly T[]): T[] {
  return items.filter((item) => canSee(family, viewerId, item));
}

/** Who may edit or delete: anyone who can see it (there is no admin). */
export const canEdit = canSee;

/** Account members who have joined and are alive: the people who open the app. */
export function activeAccountMembers(family: Family): Member[] {
  return family.members.filter((m) => m.kind === 'account' && m.status === 'active');
}

/** Members shown in the family row, memorial members last. */
export function familyRow(family: Family): Member[] {
  const order = (m: Member) => (m.status === 'memorial' ? 2 : m.isPet ? 1 : 0);
  return [...family.members].sort((a, b) => order(a) - order(b));
}

/** Display name for a member as the viewer calls them. */
export function displayName(member: Member | undefined): string {
  if (!member) return 'Someone';
  return member.relation?.trim() || firstName(member.fullName);
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
