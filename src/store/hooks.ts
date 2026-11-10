/**
 * Hooks that read the current family. Selectors return stored objects (stable
 * references), never fresh arrays, so screens re-render only on real changes.
 */
import { useMemo } from 'react';

import { findMember } from '@/domain/access';
import type { Account, Family, ID, Member } from '@/domain/types';

import { useApp, viewerIdOf } from './app-store';

export function useFamily(): Family | undefined {
  return useApp((s) => (s.session.familyId ? s.families[s.session.familyId] : undefined));
}

export function useViewerId(): ID | undefined {
  return useApp(viewerIdOf);
}

/** The signed-in person, or undefined when signed out. */
export function useAccount(): Account | undefined {
  const cloud = useApp((s) => s.cloud);
  return useMemo(
    () =>
      cloud
        ? { id: cloud.userId, email: cloud.email, name: cloud.name, google: cloud.google, hasPassword: cloud.hasPassword, familyIds: Object.keys(cloud.memberships) }
        : undefined,
    [cloud],
  );
}

/** This device holds the account's current key, so it can open and sync the family. */
export function useDeviceReady(): boolean {
  return useApp((s) => !!s.cloud && s.cloud.currentVersion > 0 && s.cloud.keyring.some((k) => k.version === s.cloud?.currentVersion));
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
