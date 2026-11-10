import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';

import { DocThumb } from '@/components/DocThumb';
import { Card, EmptyState, Row, Screen, Section } from '@/components/Layout';
import { displayName, findMember, visibleTo } from '@/domain/access';
import type { DocItem } from '@/domain/types';
import { useCtx } from '@/store/hooks';

/** Where is the original? Every paper by where it is kept. */
export default function Places() {
  const ctx = useCtx();
  const groups = useMemo(() => {
    if (!ctx) return [];
    const map = new Map<string, { label: string; docs: DocItem[] }>();
    for (const d of visibleTo(ctx.family, ctx.viewerId, ctx.family.documents)) {
      const label = d.original?.trim() || 'Not noted yet';
      const key = label.toLowerCase();
      const g = map.get(key) ?? { label, docs: [] };
      g.docs.push(d);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => (a.label === 'Not noted yet' ? 1 : b.label === 'Not noted yet' ? -1 : b.docs.length - a.docs.length));
  }, [ctx]);
  if (!ctx) return <Redirect href="/" />;

  return (
    <Screen title="Where is the original?" subtitle="No more searching every drawer" testID="places">
      {groups.length === 0 ? (
        <EmptyState icon="MapPin" title="Nothing saved yet" line="When you add a paper, note where the original lives." />
      ) : (
        groups.map((g) => (
          <Section key={g.label} title={`${g.label} (${g.docs.length})`}>
            <Card padded={false}>
              {g.docs.map((d, i) => (
                <Row
                  key={d.id}
                  title={d.title}
                  subtitle={d.ownerId ? displayName(findMember(ctx.family, d.ownerId)) : 'Family'}
                  left={<DocThumb templateId={d.templateId} file={d.files[0]} width={40} />}
                  divider={i > 0}
                  onPress={() => router.push(`/doc/${d.id}`)}
                />
              ))}
            </Card>
          </Section>
        ))
      )}
    </Screen>
  );
}
