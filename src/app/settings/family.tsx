import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Bits';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { SharingChoice } from '@/components/SharingChoice';
import { Sheet } from '@/components/Sheet';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { displayName, familyRow, findMember } from '@/domain/access';
import { canApproveRemoval } from '@/domain/family-rules';
import type { PersonalSharing } from '@/domain/types';
import { checkFamilyName, LIMITS } from '@/domain/validation';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

/** Family name, the privacy setting everyone can see and change, members, removals, and leaving. */
export default function FamilySettings() {
  const ctx = useCtx();
  const renameFamily = useApp((s) => s.renameFamily);
  const setPersonalSharing = useApp((s) => s.setPersonalSharing);
  const approveRemoval = useApp((s) => s.approveRemoval);
  const cancelRemoval = useApp((s) => s.cancelRemoval);
  const leaveFamily = useApp((s) => s.leaveFamily);
  const { palette } = useTheme();
  const [name, setName] = useState(ctx?.family.name ?? '');
  const [pendingSharing, setPendingSharing] = useState<PersonalSharing>();
  const [leaving, setLeaving] = useState(false);
  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;

  const nameCheck = checkFamilyName(name);
  return (
    <Screen title="Family" subtitle={family.name} testID="settings-family-screen">
      <Section title="Name">
        <TextField label="Family name" value={name} onChangeText={setName} max={LIMITS.familyName} check={nameCheck} testID="rename" />
        {name.trim() !== family.name && nameCheck.level !== 'error' ? (
          <Button label="Save the name" size="md" onPress={() => { renameFamily(name); toast('Renamed. Everyone sees the new name.', { tone: 'success' }); }} />
        ) : null}
      </Section>

      <Section title="Who sees personal papers">
        <SharingChoice value={family.personalSharing} onChange={(v) => v !== family.personalSharing && setPendingSharing(v)} />
        <T variant="small" color="ink2">Everyone in the family sees this setting and can change it. Every change is announced to all. There is no admin.</T>
      </Section>

      {family.removalRequests.length ? (
        <Section title="Waiting for a second member">
          <Card padded={false}>
            {family.removalRequests.map((r, i) => {
              const member = findMember(family, r.memberId);
              const canApprove = canApproveRemoval(family, viewerId, r.memberId);
              return (
                <View key={r.memberId} style={[styles.request, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line } : null]}>
                  <T variant="bodyStrong">Remove {member?.fullName ?? 'a member'}?</T>
                  <T variant="small" color="ink2">Asked by {displayName(findMember(family, r.requestedBy))}.</T>
                  <View style={styles.row}>
                    {canApprove ? (
                      <Button label="Approve" size="md" variant="danger" full={false} onPress={() => { const res = approveRemoval(r.memberId); toast(res.ok ? 'Removed' : res.error, { tone: res.ok ? 'success' : 'warn' }); }} testID="approve-removal" />
                    ) : (
                      <T variant="small" color="ink3">{r.requestedBy === viewerId ? 'You asked; someone else must approve.' : 'Waiting for another member.'}</T>
                    )}
                    <Button label="Cancel request" size="md" variant="secondary" full={false} onPress={() => cancelRemoval(r.memberId)} />
                  </View>
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}

      <Section title={`Members (${family.members.length})`}>
        <Card padded={false}>
          {familyRow(family).map((m, i) => (
            <Row
              key={m.id}
              title={m.id === viewerId ? `${m.fullName} (you)` : m.fullName}
              subtitle={m.status === 'memorial' ? 'In loving memory' : m.status === 'invited' ? `Invited: ${m.email}` : m.kind === 'account' ? m.email : m.isPet ? 'Pet' : 'Profile only'}
              left={<Avatar member={m} size={40} />}
              divider={i > 0}
              onPress={() => router.push(`/member/${m.id}`)}
            />
          ))}
        </Card>
        <Button label="Add a member" icon="UserPlus" variant="secondary" onPress={() => router.push('/member/new')} />
      </Section>

      {!family.isSample ? (
        <Section title="Leave">
          <T variant="small" color="ink2">You keep nothing of the family’s common papers; your own personal papers leave with you. The family keeps going without you.</T>
          <Button label={`Leave ${family.name}`} icon="LogOut" variant="danger" onPress={() => setLeaving(true)} testID="leave-family" />
        </Section>
      ) : null}

      <Sheet
        visible={!!pendingSharing}
        onClose={() => setPendingSharing(undefined)}
        title={pendingSharing === 'private' ? 'Make personal papers private?' : 'Share personal papers with everyone?'}
        subtitle={pendingSharing === 'private' ? 'Each person will see only their own personal papers, plus the family’s. Everyone is told.' : 'Everyone will see everyone’s personal papers. Only me items stay private. Everyone is told.'}
      >
        <SlideToConfirm
          label="Slide to change"
          testID="slide-sharing"
          onConfirm={() => {
            if (pendingSharing) setPersonalSharing(pendingSharing);
            setPendingSharing(undefined);
            toast('Changed. Everyone in the family has been told.', { tone: 'success' });
          }}
        />
      </Sheet>
      <Sheet visible={leaving} onClose={() => setLeaving(false)} title={`Leave ${family.name}?`} subtitle="You can be invited back any time.">
        <SlideToConfirm
          label="Slide to leave"
          tone="sindoor"
          onConfirm={() => {
            setLeaving(false);
            leaveFamily();
            toast('You left the family');
            router.replace('/');
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  request: { padding: space.lg, gap: 4 },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.sm, alignItems: 'center', flexWrap: 'wrap' },
});
