import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, Screen } from '@/components/Layout';
import { Pressy } from '@/components/Pressy';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { canSee, displayName, findMember } from '@/domain/access';
import { daysUntil, formatDateTime, relativeDays } from '@/domain/dates';
import type { Task } from '@/domain/types';
import { stampFor } from '@/lib/attention';
import { haptic } from '@/lib/device';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { space, TAB_BAR_HEIGHT } from '@/theme/tokens';

type Filter = 'mine' | 'all' | 'done';

export default function Todo() {
  const ctx = useCtx();
  const { palette } = useTheme();
  const setTaskDone = useApp((s) => s.setTaskDone);
  const [filter, setFilter] = useState<Filter>('mine');
  const [renew, setRenew] = useState<{ docId: string; title: string }>();

  const tasks = useMemo(() => {
    if (!ctx) return [];
    const { family, viewerId } = ctx;
    const live = family.tasks.filter((t) => !t.deletedAt);
    const byDue = (a: Task, b: Task) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
    if (filter === 'done') return live.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    const open = live.filter((t) => !t.done);
    return (filter === 'mine' ? open.filter((t) => t.assignees.length === 0 || t.assignees.includes(viewerId)) : open).sort(byDue);
  }, [ctx, filter]);

  if (!ctx) return null;
  const { family, viewerId } = ctx;

  const complete = (task: Task) => {
    haptic.success();
    setTaskDone(task.id, !task.done);
    if (task.done) return;
    const doc = task.linkedDocId ? family.documents.find((d) => d.id === task.linkedDocId) : undefined;
    if (doc && !doc.deletedAt && doc.expiryDate && canSee(family, viewerId, doc)) {
      setRenew({ docId: doc.id, title: doc.title });
    } else {
      toast(`Done: ${task.title}`, { tone: 'success', action: { label: 'Undo', onPress: () => setTaskDone(task.id, false) } });
    }
  };

  return (
    <Screen
      title="To-do"
      large
      subtitle="Ghar ke kaam, with a date and a reminder."
      back={false}
      bottomInset={TAB_BAR_HEIGHT}
      right={
        <Pressable onPress={() => router.push('/task/new')} accessibilityRole="button" accessibilityLabel="Add a task" style={[styles.round, { backgroundColor: palette.accent }]}>
          <Icon name="Plus" size={24} color="onAccent" />
        </Pressable>
      }
      testID="todo"
    >
      <Segmented<Filter>
        testID="todo-filter"
        value={filter}
        onChange={setFilter}
        options={[{ value: 'mine', label: 'For me' }, { value: 'all', label: 'Everyone' }, { value: 'done', label: 'Done' }]}
      />
      <View style={styles.gap} />
      {tasks.length === 0 ? (
        <EmptyState
          icon="ListTodo"
          title={filter === 'done' ? 'Nothing finished yet' : 'Nothing pending'}
          line={filter === 'done' ? 'Finished tasks show here.' : 'Ghar mein sab theek hai. Add a task when something needs doing.'}
          action={filter !== 'done' ? <Button label="Add a task" icon="Plus" variant="secondary" full={false} onPress={() => router.push('/task/new')} /> : undefined}
        />
      ) : (
        <Card padded={false}>
          {tasks.map((task, i) => {
            const days = task.dueAt ? daysUntil(task.dueAt) : null;
            const stamp = !task.done && days !== null && days <= 7 ? stampFor({ daysLeft: days, kind: 'task', date: task.dueAt as string }) : null;
            const who = task.assignees.length ? task.assignees.map((id) => findMember(family, id)).filter(Boolean) : [];
            return (
              <View key={task.id} style={[styles.task, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line } : null]}>
                <Pressable
                  testID={`task-check-${task.id}`}
                  onPress={() => complete(task)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: task.done }}
                  accessibilityLabel={`Mark ${task.title} ${task.done ? 'not done' : 'done'}`}
                  hitSlop={8}
                  style={[styles.check, { borderColor: task.done ? palette.accent : palette.ink3, backgroundColor: task.done ? palette.accent : 'transparent' }]}
                >
                  {task.done ? <Icon name="Check" size={18} color="onAccent" strokeWidth={2.6} /> : null}
                </Pressable>
                <Pressy style={styles.taskBody} onPress={() => router.push(`/task/${task.id}`)} scaleTo={0.99} testID={`task-${task.id}`}>
                  <T variant="bodyStrong" color={task.done ? 'ink3' : 'ink'} style={task.done ? styles.struck : undefined}>{task.title}</T>
                  <T variant="small" color={days !== null && days < 0 && !task.done ? 'sindoor' : 'ink2'}>
                    {task.done
                      ? `Done by ${displayName(findMember(family, task.doneBy))}`
                      : task.dueAt
                        ? `${formatDateTime(task.dueAt)} · ${relativeDays(days as number)}`
                        : 'No date'}
                  </T>
                  <View style={styles.who}>
                    {who.length ? (
                      who.slice(0, 4).map((m) => (m ? <Avatar key={m.id} member={m} size={22} /> : null))
                    ) : (
                      <T variant="small" color="ink3">Anyone</T>
                    )}
                    {task.repeat !== 'none' ? <Icon name="Repeat" size={14} color="ink3" /> : null}
                  </View>
                </Pressy>
                {stamp ? <Stamp text={stamp.text} tone={stamp.tone} /> : null}
              </View>
            );
          })}
        </Card>
      )}

      <Sheet
        visible={!!renew}
        onClose={() => setRenew(undefined)}
        title="Done! Add the new copy?"
        subtitle={renew ? `Put the renewed ${renew.title} in the almari, and the reminder resets.` : undefined}
      >
        <View style={styles.sheet}>
          <Button
            label="Add it now"
            icon="Camera"
            testID="renew-now"
            onPress={() => {
              const id = renew?.docId;
              setRenew(undefined);
              if (id) router.push({ pathname: '/doc/new', params: { id, renew: '1' } });
            }}
          />
          <Button label="Later" variant="secondary" onPress={() => setRenew(undefined)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: space.lg },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  task: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  taskBody: { flex: 1, gap: 2 },
  struck: { textDecorationLine: 'line-through' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sheet: { gap: space.md },
});
