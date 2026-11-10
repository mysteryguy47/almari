/** Associated-data contexts: every box says what it belongs to, so it cannot be moved elsewhere. */
export const ikContext = (familyId: string, id: string) => `ik:${familyId}:${id}`;
export const recordContext = (familyId: string, id: string, kind: string) => `rec:${familyId}:${id}:${kind}`;
export const fileContext = (familyId: string, fileId: string) => `file:${familyId}:${fileId}`;
export const inviteContext = (familyId: string, memberId: string) => `invite:${familyId}:${memberId}`;
