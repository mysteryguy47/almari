import { Redirect } from 'expo-router';

import { Avatar } from '@/components/Bits';
import { Card, EmptyState, Row, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { displayName, findMember } from '@/domain/access';
import { useCtx } from '@/store/hooks';

function when(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Who added, changed, shared or deleted what. It records actions, never who looked at what. */
export default function Activity() {
  const ctx = useCtx();
  if (!ctx) return <Redirect href="/" />;
  const { family } = ctx;
  return (
    <Screen title="Activity" subtitle="Informs without spying: views are never recorded" testID="activity">
      {family.activity.length === 0 ? (
        <EmptyState icon="Activity" title="Quiet so far" line="Changes by anyone in the family show here." />
      ) : (
        <Card padded={false}>
          {family.activity.slice(0, 100).map((a, i) => {
            const by = findMember(family, a.by);
            return (
              <Row
                key={a.id}
                title={`${by ? displayName(by) : 'Someone'} ${a.text}`}
                subtitle={when(a.at)}
                left={by ? <Avatar member={by} size={36} /> : undefined}
                divider={i > 0}
              />
            );
          })}
        </Card>
      )}
      <T variant="small" color="ink3" style={{ marginTop: 16 }}>The last 300 changes are kept.</T>
    </Screen>
  );
}
