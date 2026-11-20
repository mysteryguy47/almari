import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { displayName, findMember, visibleTo } from '@/domain/access';
import { readiness } from '@/domain/family-rules';
import { searchEntries, templateEntries } from '@/domain/search';
import {
  CATEGORIES, CUSTOM_TEMPLATE, getCategory, getTemplate, TEMPLATES, templatesIn, type CategoryId, type Template,
} from '@/domain/templates';
import type { ID } from '@/domain/types';
import { haptic } from '@/lib/device';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, tintColors } from '@/theme/tokens';

import { Button } from './Button';
import { TextField } from './Fields';
import { Icon } from './Icon';
import { Card, Row, Section } from './Layout';
import { DocMark } from './Marks';
import { Pressy } from './Pressy';
import { T } from './Text';

/** Short names for the category strip, where every letter counts. */
const SHORT: Partial<Record<CategoryId, string>> = {
  photo: 'Photo & sign',
  work: 'Work',
  money: 'Bank & money',
  home: 'Home',
  legal: 'Legal',
  bills: 'Bills',
  insurance: 'Insurance',
  business: 'Business',
  land: 'Land',
};

/**
 * Step one: "What are you adding?" Gaps first, then search, then every
 * category in one strip that scrolls sideways, and that category's papers.
 */
export function TemplatePicker({ onPick, initialCategory, ownerId }: { onPick: (t: Template) => void; initialCategory?: CategoryId; ownerId?: ID }) {
  const ctx = useCtx();
  const { palette } = useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId>(initialCategory ?? 'identity');
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const placed = useRef<Record<string, number>>({});
  const scrolled = useRef(false);
  const entries = useMemo(() => templateEntries(TEMPLATES), []);
  const results = query.trim() ? searchEntries(query, entries, 12) : [];
  const gaps = useMemo(() => {
    if (!ctx) return [];
    return readiness(ctx.family, ctx.viewerId).items.filter((i) => !i.done && !i.hidden && (!ownerId || i.memberId === ownerId || !i.memberId)).slice(0, 4);
  }, [ctx, ownerId]);
  /** One-per-person papers this person already has. */
  const owned = useMemo(() => {
    if (!ctx || !ownerId) return new Set<string>();
    return new Set(visibleTo(ctx.family, ctx.viewerId, ctx.family.documents).filter((d) => d.ownerId === ownerId).map((d) => d.templateId));
  }, [ctx, ownerId]);
  if (!ctx) return null;

  const owner = ownerId ? findMember(ctx.family, ownerId) : undefined;
  const savedNote = (t: Template) =>
    t.unique && owned.has(t.id) ? (owner && owner.id !== ctx.viewerId ? `${displayName(owner)} has one. Adds a version.` : 'Saved. Adds a version.') : undefined;

  return (
    <View>
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Aadhaar, RC, cheque, marksheet, bima…" autoCapitalize="none" testID="template-search" />
      {query.trim() ? (
        <Card padded={false}>
          {results.length ? (
            results.map((r, i) => {
              const t = getTemplate(r.id);
              return (
                <Row
                  key={r.id}
                  testID={`template-${r.id}`}
                  title={t.name}
                  subtitle={savedNote(t) ?? getCategory(t.category).name}
                  left={<DocMark templateId={t.id} />}
                  divider={i > 0}
                  onPress={() => onPick(t)}
                />
              );
            })
          ) : (
            <Row title="Something else" subtitle={`Save “${query.trim()}” with a title and a file`} icon="FileText" onPress={() => onPick(CUSTOM_TEMPLATE)} />
          )}
        </Card>
      ) : (
        <>
          {gaps.length ? (
            <Section title="Missing, worth adding">
              <Card padded={false}>
                {gaps.map((g, i) => {
                  const t = getTemplate(g.templateId);
                  const who = g.memberId ? findMember(ctx.family, g.memberId) : undefined;
                  return (
                    <Row
                      key={g.key}
                      title={who ? `${who.id === ctx.viewerId ? 'Your' : `${displayName(who)}’s`} ${g.label}` : g.label}
                      left={<DocMark templateId={t.id} />}
                      divider={i > 0}
                      onPress={() => onPick(t)}
                    />
                  );
                })}
              </Card>
            </Section>
          ) : null}
          <Section title="Browse">
            <ScrollView
              ref={strip}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
              style={styles.stripOuter}
              accessibilityRole="tablist"
            >
              {CATEGORIES.map((c) => {
                const on = c.id === category;
                const { fg, bg } = tintColors(palette, c.tint);
                return (
                  <View
                    key={c.id}
                    onLayout={(e) => {
                      placed.current[c.id] = e.nativeEvent.layout.x;
                      // Opened on a category (Vehicles, from a vehicle's page): bring it into view.
                      if (!scrolled.current && initialCategory === c.id) {
                        scrolled.current = true;
                        strip.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 60), animated: false });
                      }
                    }}
                  >
                  <Pressy
                    testID={`cat-${c.id}`}
                    onPress={() => {
                      haptic.tap();
                      setCategory(c.id);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={c.name}
                    scaleTo={0.95}
                    style={styles.cat}
                  >
                    <View style={[styles.catIcon, { backgroundColor: on ? fg : bg }]}>
                      <Icon name={c.icon} size={22} rawColor={on ? palette.surface : fg} />
                    </View>
                    <T variant="small" color={on ? 'ink' : 'ink2'} align="center" numberOfLines={2} style={on ? styles.catOn : null}>
                      {SHORT[c.id] ?? c.name}
                    </T>
                    <View style={[styles.dot, { backgroundColor: on ? fg : 'transparent' }]} />
                  </Pressy>
                  </View>
                );
              })}
            </ScrollView>
            <Animated.View key={category} entering={FadeIn.duration(180)}>
              <Card padded={false}>
                {templatesIn(category).map((t, i) => {
                  const note = savedNote(t);
                  return (
                    <Row
                      key={t.id}
                      testID={`template-${t.id}`}
                      title={t.name}
                      subtitle={note}
                      left={<DocMark templateId={t.id} />}
                      divider={i > 0}
                      onPress={() => onPick(t)}
                    />
                  );
                })}
              </Card>
            </Animated.View>
          </Section>
          <Button label="Something else" variant="secondary" icon="Plus" onPress={() => onPick(CUSTOM_TEMPLATE)} testID="template-custom" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stripOuter: { marginHorizontal: -space.xl },
  strip: { paddingHorizontal: space.xl - 4, gap: 2, paddingBottom: space.xs },
  cat: { width: 78, alignItems: 'center', gap: 6, paddingVertical: space.xs, borderRadius: radius.md },
  catIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catOn: { fontWeight: '600' },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
