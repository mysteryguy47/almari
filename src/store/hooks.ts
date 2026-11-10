/**
 * Hooks that read the current family. Selectors return stored objects (stable
 * references), never fresh arrays, so screens re-render only on real changes.
 */
import { findMember } from '@/domain/access';
import type { Account, Family, ID, Member } from '@/domain/types';

import { useApp, viewerIdOf } from './app-store';

export function useFamily(): Family | undefined {
  return useApp((s) => (s.session.familyId ? s.families[s.session.familyId] : undefined));
}

export function useViewerId(): ID | undefined {
  return useApp(viewerIdOf);
}

export function useAccount(): Account | undefined {
  return useApp((s) => (s.session.accountId ? s.accounts[s.session.accountId] : undefined));
}

export interface Ctx {
  family: Family;
  viewerId: ID;
  viewer: Member;
}

/** The open family and who is looking, or undefined when there is none (screens then redirect home). */
export function useCtx(): Ctx | undefined {
  const family = useFamily();
  const viewerId = useViewerId();
  const viewer = family && viewerId ? findMember(family, viewerId) : undefined;
  if (!family || !viewerId || !viewer) return undefined;
  return { family, viewerId, viewer };
}
