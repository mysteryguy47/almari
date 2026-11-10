import { Redirect, router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Bits';
import { TextField } from '@/components/Fields';
import { Card, EmptyState, Row, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import type { IconName } from '@/domain/icons';
import { buildIndex, searchEntries, type HitKind, type SearchHit } from '@/domain/search';
import type { Tint } from '@/domain/templates';
import { useCtx } from '@/store/hooks';
import { space } from '@/theme/tokens';

const KIND: Record<HitKind, { icon: IconName; tint: Tint; href: (id: string) => Href; label: string }> = {
  person: { icon: 'User', tint: 'almari', href: (id) => `/person/${id}`, label: 'Person' },
  doc: { icon: 'FileText', tint: 'lifafa', href: (id) => `/doc/${id}`, label: 'Paper' },
  login: { icon: 'KeyRound', tint: 'stamp', href: (id) => `/login/${id}`, label: 'Login' },
  bank: { icon: 'Landmark', tint: 'haldi', href: (id) => `/bank/${id}`, label: 'Account' },
  card: { icon: 'CreditCard', tint: 'inland', href: (id) => `/card/${id}`, label: 'Card' },
  note: { icon: 'StickyNote', tint: 'stamp', href: (id) => `/note/${id}`, label: 'Note' },
  task: { icon: 'ListTodo', tint: 'almari', href: (id) => `/task/${id}`, label: 'Task' },
  contact: { icon: 'Phone', tint: 'haldi', href: (id) => `/contact/${id}`, label: 'Number' },
  template: { icon: 'Plus', tint: 'almari', href: (id) => ({ pathname: '/doc/new', params: { template: id } }), label: 'Add' },
};

const TRY = ['pan', 'adhar', 'gaadi', 'bima', 'registry', 'wifi', 'locker'];

/** Offline search across papers, numbers, people and the locker. Forgives typos and Hinglish. */
export default function Search() {
  const ctx = useCtx();
  const [query, setQuery] = useState('');
  const index = useMemo(() => (ctx ? buildIndex(ctx.family, ctx.viewerId) : []), [ctx]);
  const hits: SearchHit[] = useMemo(() => searchEntries(query, index, 40), [query, index]);
  if (!ctx) return <Redirect href="/" />;

  return (
    <Screen title="Search" testID="search">
      <TextField label="Search the almari" value={query} onChangeText={setQuery} placeholder="Papa ka PAN, gaadi, bima, wifi…" autoCapitalize="none" testID="search-input" />
      {!query.trim() ? (
        <View style={styles.try}>
          <T variant="small" color="ink2">Try</T>
          <View style={styles.chips}>
            {TRY.map((t) => <Chip key={t} label={t} onPress={() => setQuery(t)} />)}
          </View>
        </View>
      ) : hits.length ? (
        <Card padded={false}>
          {hits.map((h, i) => (
            <Row
              key={`${h.kind}:${h.id}`}
              testID={`hit-${h.kind}-${h.id}`}
              title={h.title}
              subtitle={[KIND[h.kind].label, h.subtitle].filter(Boolean).join(' · ')}
              icon={KIND[h.kind].icon}
              tint={KIND[h.kind].tint}
              divider={i > 0}
              onPress={() => router.push(KIND[h.kind].href(h.id))}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="Search" title="Nothing found" line={`Nothing matches “${query.trim()}”. Private papers of others are never searched.`} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  try: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
