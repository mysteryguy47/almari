import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Nudge } from '@/domain/nudges';
import { useApp } from '@/store/app-store';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

import { Avatar, IconTile } from './Bits';
import { Button } from './Button';
import { Card } from './Layout';
import { T } from './Text';
import type { Member } from '@/domain/types';

/** "Coming up for the family": life-stage nudges, each one tap from a task. */
export function NudgeCards({ nudges, members, limit = 3 }: { nudges: Nudge[]; members: Member[]; limit?: number }) {
  const saveTask = useApp((s) => s.saveTask);
  const dismissNudge = useApp((s) => s.dismissNudge);
  return (
    <View style={styles.list}>
      {nudges.slice(0, limit).map((n) => {
        const member = members.find((m) => m.id === n.memberId);
        return (
          <Card key={n.key} style={styles.card}>
            <View style={styles.head}>
              {member ? <Avatar member={member} size={36} /> : <IconTile icon="Sparkles" tint="stamp" size={36} />}
              <View style={styles.flex}>
                <T variant="bodyStrong">{n.title}</T>
                <T variant="small" color="ink2">{n.detail}</T>
              </View>
            </View>
            <View style={styles.actions}>
              <Button
                label="Make a task"
                icon="ListTodo"
                size="md"
                full={false}
                testID={`nudge-task-${n.rule}`}
                onPress={() => {
                  const r = saveTask({ title: n.taskTitle, assignees: [], dueAt: n.dueDate ? `${n.dueDate}T10:00` : undefined, repeat: n.rule === 'life-certificate' ? 'yearly' : 'none' });
                  dismissNudge(n.key);
                  if (r.ok) toast('Added to the family to-do', { tone: 'success', action: { label: 'Open', onPress: () => router.push(`/task/${r.value}`) } });
                }}
              />
              <Button label="Not now" size="md" variant="ghost" full={false} onPress={() => dismissNudge(n.key)} testID={`nudge-dismiss-${n.rule}`} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  list: { gap: space.md },
  card: { gap: space.md },
  head: { flexDirection: 'row', gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
