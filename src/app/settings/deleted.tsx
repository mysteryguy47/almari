import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Card, EmptyState, Row, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { displayName, findMember } from '@/domain/access';
import type { ID } from '@/domain/types';
import { RECENTLY_DELETED_DAYS, useApp, type Collection } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';

type Gone = { collection: Collection; id: ID; title: string; deletedAt: number; deletedBy?: ID };

/** Anything deleted waits here for 30 days, and anyone in the family can bring it back. */
export default function RecentlyDeleted() {
  const ctx = useCtx();
  const restoreItem = useApp((s) => s.restoreItem);
  const [now] = useState(Date.now);
  const items = useMemo(() => {
    if (!ctx) return [];
    const f = ctx.family;
    const out: Gone[] = [];
    const take = (collection: Collection, list: { id: ID; deletedAt?: number; deletedBy?: ID; onlyMe: boolean; createdBy: ID }[], title: (x: never) => string) => {
      for (const x of list) {
        if (!x.deletedAt) continue;
        if (x.onlyMe && x.createdBy !== ctx.viewerId) continue; // private items stay private, even in the bin
        out.push({ collection, id: x.id, title: title(x as never), deletedAt: x.deletedAt, deletedBy: x.deletedBy });
      }
    };
    take('documents', f.documents, (d: { title: string }) => d.title);
    take('logins', f.logins, (d: { title: string }) => d.title);
    take('bankAccounts', f.bankAccounts, (d: { bank: string }) => `${d.bank} account`);
    take('cards', f.cards, (d: { bank: string }) => `${d.bank} card`);
    take('notes', f.notes, (d: { title: string }) => d.title);
    return out.sort((a, b) => b.deletedAt - a.deletedAt);
  }, [ctx]);
  if (!ctx) return <Redirect href="/" />;

  return (
    <Screen title="Recently deleted" subtitle={`Kept for ${RECENTLY_DELETED_DAYS} days`} testID="deleted">
      {items.length === 0 ? (
        <EmptyState icon="Trash" title="Nothing here" line="Deleted papers wait here for 30 days, in case." />
      ) : (
        <Card padded={false}>
          {items.map((it, i) => {
            const daysLeft = RECENTLY_DELETED_DAYS - Math.floor((now - it.deletedAt) / 86_400_000);
            return (
              <Row
                key={`${it.collection}:${it.id}`}
                title={it.title}
                subtitle={`Deleted by ${displayName(findMember(ctx.family, it.deletedBy))} · ${daysLeft} days left`}
                icon="Trash"
                tint="sindoor"
                divider={i > 0}
                chevron={false}
                right={<Button label="Restore" size="md" variant="secondary" full={false} onPress={() => { restoreItem(it.collection, it.id); toast(`Restored ${it.title}`, { tone: 'success' }); }} />}
              />
            );
          })}
        </Card>
      )}
      <T variant="small" color="ink3" style={{ marginTop: 16 }}>After 30 days they are gone for good, including the files.</T>
    </Screen>
  );
}
