/**
 * Pieces shared by the Locker screens: who an item belongs to, the Only me
 * switch, and the delete-with-undo flow.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { displayName, findMember } from '@/domain/access';
import type { Family, ID, Member } from '@/domain/types';
import type { Collection } from '@/store/app-store';
import { useApp } from '@/store/app-store';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

import { Button } from './Button';
import { ToggleRow } from './Fields';
import { Card, goBack, Section } from './Layout';
import { FAMILY, MemberPicker } from './MemberPicker';
import { Sheet } from './Sheet';
import { SlideToConfirm } from './SlideToConfirm';
import { T } from './Text';

export function OwnerPicker({ family, value, onChange, allowFamily, title = 'Whose is it?' }: {
  family: Family; value: ID | undefined; onChange: (id: ID | undefined) => void; allowFamily?: boolean; title?: string;
}) {
  const members = family.members.filter((m: Member) => m.status !== 'memorial' && !m.isPet);
  return (
    <Section title={title}>
      <MemberPicker
        members={members}
        value={[value ?? FAMILY]}
        onChange={(v) => onChange(v[0] === FAMILY ? undefined : v[0])}
        allowFamily={allowFamily}
        familyLabel="Family"
        testID="owner"
      />
    </Section>
  );
}

export function OnlyMeToggle({ visible, value, onChange }: { visible: boolean; value: boolean; onChange: (v: boolean) => void }) {
  if (!visible) return null;
  return (
    <Card style={{ marginBottom: space.lg }}>
      <ToggleRow title="Only me" subtitle="Nobody else in the family sees this, whatever the family setting." value={value} onValueChange={onChange} testID="only-me" />
    </Card>
  );
}

export function ownerName(family: Family, viewerId: ID, ownerId: ID | undefined): string {
  if (!ownerId) return 'Family';
  if (ownerId === viewerId) return 'Yours';
  return displayName(findMember(family, ownerId));
}

/** A Delete button that asks once (slide to confirm) and offers Undo. */
export function DeleteItem({ collection, id, title }: { collection: Collection; id: ID; title: string }) {
  const deleteItem = useApp((s) => s.deleteItem);
  const restoreItem = useApp((s) => s.restoreItem);
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: space.lg }}>
      <Button label="Delete" icon="Trash" variant="danger" onPress={() => setOpen(true)} testID="delete" />
      <Sheet visible={open} onClose={() => setOpen(false)} title={`Delete ${title}?`} subtitle="Kept in Recently deleted for 30 days. Anyone in the family can restore it.">
        <SlideToConfirm
          label="Slide to delete"
          tone="sindoor"
          testID="slide-delete"
          onConfirm={() => {
            setOpen(false);
            deleteItem(collection, id);
            toast(`Deleted ${title}`, { action: { label: 'Undo', onPress: () => restoreItem(collection, id) } });
            goBack();
          }}
        />
      </Sheet>
    </View>
  );
}

export function NotFound() {
  return (
    <Card>
      <T variant="body" color="ink2">This item is not available. It may be private to someone else, or it was deleted.</T>
    </Card>
  );
}
