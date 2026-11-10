import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipChoice, DateField, TextField } from '@/components/Fields';
import { Card, goBack, Screen, Section } from '@/components/Layout';
import { MemberPicker } from '@/components/MemberPicker';
import { T } from '@/components/Text';
import { activeAccountMembers, displayName, findMember, visibleTo } from '@/domain/access';
import { formatDate } from '@/domain/dates';
import type { Repeat } from '@/domain/types';
import { checkTaskTitle, LIMITS } from '@/domain/validation';
import { REPEATS, TIMES } from '@/lib/options';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

/** A family task: what, for whom (or anyone), by when, repeating or not, linked to a paper. */
export default function TaskScreen() {
  const { id, doc: docParam } = useLocalSearchParams<{ id: string; doc?: string }>();
  const ctx = useCtx();
  const saveTask = useApp((s) => s.saveTask);
  const setTaskDone = useApp((s) => s.setTaskDone);
  const nudgeTask = useApp((s) => s.nudgeTask);
  const deleteTask = useApp((s) => s.deleteTask);
  const restoreTask = useApp((s) => s.restoreTask);
  const task = ctx && id !== 'new' ? ctx.family.tasks.find((t) => t.id === id && !t.deletedAt) : undefined;

  const [title, setTitle] = useState(task?.title ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const [assignees, setAssignees] = useState<string[]>(task?.assignees ?? []);
  const [date, setDate] = useState<string | undefined>(task?.dueAt?.slice(0, 10));
  const [time, setTime] = useState(task?.dueAt?.slice(11, 16) ?? '18:00');
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? 'none');
  const [linkedDocId, setLinkedDocId] = useState<string | undefined>(task?.linkedDocId ?? docParam);
  const [tried, setTried] = useState(false);

  const docs = useMemo(() => {
    if (!ctx) return [];
    return visibleTo(ctx.family, ctx.viewerId, ctx.family.documents).filter((d) => d.expiryDate).sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')).slice(0, 12);
  }, [ctx]);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  if (id !== 'new' && !task) return <Redirect href="/todo" />;
  const people = activeAccountMembers(family).concat(family.members.filter((m) => m.kind === 'account' && m.status === 'invited'));

  const check = checkTaskTitle(title);
  const save = () => {
    setTried(true);
    if (check.level === 'error') return;
    const result = saveTask({
      id: task?.id, title: title.trim(), note: note.trim() || undefined, assignees, dueAt: date ? `${date}T${time}` : undefined,
      repeat, linkedDocId,
    });
    if (!result.ok) return toast(result.error, { tone: 'warn' });
    const who = assignees.length ? assignees.map((a) => (a === viewerId ? 'you' : displayName(findMember(family, a)))).join(', ') : 'anyone';
    toast(task ? 'Task updated' : `Assigned to ${who}${date ? `, due ${formatDate(date)}` : ''}`, { tone: 'success' });
    goBack();
  };

  const othersAssigned = task && task.assignees.some((a) => a !== viewerId);

  return (
    <Screen title={task ? 'Task' : 'New task'} footer={<Button label="Save" onPress={save} testID="task-save" />} testID="task">
      <TextField label="What needs doing?" value={title} onChangeText={setTitle} max={LIMITS.taskTitle} required check={check} showCheck={tried} placeholder="Renew car insurance" testID="task-title" />
      <Section title="For whom">
        <MemberPicker members={people} value={assignees} onChange={setAssignees} multiple allowFamily familyLabel="Anyone" testID="task-who" />
        <T variant="small" color="ink3">{assignees.length ? 'They are told at once, and reminded the evening before and the morning of.' : 'Everyone sees it; anyone can do it.'}</T>
      </Section>
      <DateField label="Due date" value={date} onChange={setDate} testID="task-date" />
      {date ? (
        <Section title="Time">
          <ChipChoice options={TIMES} value={time} onChange={setTime} testID="task-time" />
        </Section>
      ) : null}
      <Section title="Repeat">
        <ChipChoice options={REPEATS} value={repeat} onChange={setRepeat} testID="task-repeat" />
      </Section>
      {docs.length ? (
        <Section title="Linked paper (optional)">
          <ChipChoice
            options={[{ value: '', label: 'None' }, ...docs.map((d) => ({ value: d.id, label: d.title }))]}
            value={linkedDocId ?? ''}
            onChange={(v) => setLinkedDocId(v || undefined)}
            testID="task-doc"
          />
          <T variant="small" color="ink3">When the task is done, the app asks for the renewed copy.</T>
        </Section>
      ) : null}
      <TextField label="Note" value={note} onChangeText={setNote} multiline max={LIMITS.taskNote} />

      {task ? (
        <Card style={styles.actions}>
          <Button
            label={task.done ? 'Mark not done' : 'Mark done'}
            icon="Check"
            variant="secondary"
            onPress={() => {
              setTaskDone(task.id, !task.done);
              goBack();
            }}
            testID="task-done"
          />
          {othersAssigned && !task.done ? (
            <Button
              label="Send a polite reminder"
              icon="Bell"
              variant="secondary"
              testID="task-nudge"
              onPress={() => {
                const r = nudgeTask(task.id);
                toast(r.ok ? 'Reminder sent. One a day, so nobody is nagged.' : r.error, { tone: r.ok ? 'success' : 'warn' });
              }}
            />
          ) : null}
          <Button
            label="Delete task"
            icon="Trash"
            variant="danger"
            onPress={() => {
              deleteTask(task.id);
              toast('Task deleted', { action: { label: 'Undo', onPress: () => restoreTask(task.id) } });
              router.back();
            }}
          />
          <View />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.md, marginTop: space.md },
});
