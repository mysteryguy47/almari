import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, IconTile, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { DocThumb } from '@/components/DocThumb';
import { Card, Row, Screen, Section } from '@/components/Layout';
import { T } from '@/components/Text';
import { displayName, findMember, visibleTo } from '@/domain/access';
import { daysUntil, formatDate } from '@/domain/dates';
import { listNumber } from '@/domain/money';
import { getCategory, getTemplate, templatesIn, type CategoryId } from '@/domain/templates';
import { stampFor } from '@/lib/attention';
import { useCtx } from '@/store/hooks';
import { space } from '@/theme/tokens';

/** One category's papers, e.g. Vehicles: RC, insurance, PUC. */
export default function Category() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const category = getCategory(id);

  const docs = useMemo(() => {
    if (!ctx) return [];
    return visibleTo(ctx.family, ctx.viewerId, ctx.family.documents)
      .filter((d) => getTemplate(d.templateId).category === category.id)
      .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') || a.title.localeCompare(b.title));
  }, [ctx, category.id]);

  if (!ctx) return <Redirect href="/" />;
  const templates = templatesIn(category.id as CategoryId);
  const saved = new Set(docs.map((d) => d.templateId));

  return (
    <Screen title={category.name} subtitle={category.scope === 'common' ? 'Shared with the whole family' : 'Personal papers'} testID="category">
      <View style={styles.head}>
        <IconTile icon={category.icon} tint={category.tint} size={56} />
        <T variant="body" color="ink2" style={styles.flex}>
          {docs.length ? `${docs.length} saved` : 'Nothing saved here yet.'}
        </T>
      </View>
      {docs.length ? (
        <Card padded={false}>
          {docs.map((d, i) => {
            const days = d.expiryDate ? daysUntil(d.expiryDate) : null;
            const stamp = days !== null && days <= 30 ? stampFor({ daysLeft: days, kind: 'doc', date: d.expiryDate as string }) : null;
            const owner = d.ownerId ? findMember(ctx.family, d.ownerId) : undefined;
            return (
              <Row
                key={d.id}
                testID={`doc-${d.id}`}
                title={d.title}
                subtitle={[owner ? displayName(owner) : null, d.expiryDate ? `${getTemplate(d.templateId).expiry?.label ?? 'Expires'} ${formatDate(d.expiryDate)}` : listNumber(d.templateId, d.number)].filter(Boolean).join(' · ')}
                left={<DocThumb templateId={d.templateId} file={d.files[0]} width={44} />}
                divider={i > 0}
                right={stamp ? <Stamp text={stamp.text} tone={stamp.tone} /> : d.onlyMe ? <Stamp text="Only me" /> : undefined}
                onPress={() => router.push(`/doc/${d.id}`)}
              />
            );
          })}
        </Card>
      ) : null}
      <Section title="Add" style={styles.add}>
        <View style={styles.chips}>
          {templates.map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              icon={saved.has(t.id) ? 'Check' : 'Plus'}
              onPress={() => router.push({ pathname: '/doc/new', params: { template: t.id } })}
            />
          ))}
        </View>
      </Section>
      <Button label="Something else" variant="ghost" icon="Plus" onPress={() => router.push({ pathname: '/doc/new', params: { template: 'custom' } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  add: { marginTop: space.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
