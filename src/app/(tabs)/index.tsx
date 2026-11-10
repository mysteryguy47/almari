import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, IconTile, Nameplate, Stamp } from '@/components/Bits';
import { FamilySwitcher, ViewAsSheet } from '@/components/FamilySheets';
import { NudgeCards } from '@/components/Nudges';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen, Section, Tile } from '@/components/Layout';
import { Pressy } from '@/components/Pressy';
import { T } from '@/components/Text';
import { displayName, familyRow, findMember, firstName, visibleTo } from '@/domain/access';
import { relativeDays } from '@/domain/dates';
import { establishedYear, readiness } from '@/domain/family-rules';
import { lifeStageNudges } from '@/domain/nudges';
import { attentionFor } from '@/domain/reminders';
import { COMMON_CATEGORIES, getTemplate } from '@/domain/templates';
import { attentionHref, stampFor } from '@/lib/attention';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, TAB_BAR_HEIGHT } from '@/theme/tokens';

const LINES = [
  'Ghar ke saare kaagaz, ek jagah.',
  'No more “photocopy kahan rakhi thi?”',
  'Mummy ki almari, ab phone mein.',
  'Bina internet, bina OTP.',
  'Every paper in its place. Even the fridge warranty.',
];

export default function Home() {
  const ctx = useCtx();
  const { palette } = useTheme();
  const [switcher, setSwitcher] = useState(false);
  const [viewAs, setViewAs] = useState(false);

  const data = useMemo(() => {
    if (!ctx) return null;
    const { family, viewerId } = ctx;
    const docs = visibleTo(family, viewerId, family.documents);
    return {
      attention: attentionFor(family, viewerId),
      nudges: lifeStageNudges(family),
      people: familyRow(family),
      ready: readiness(family, viewerId),
      counts: Object.fromEntries(COMMON_CATEGORIES.map((c) => [c.id, docs.filter((d) => !d.ownerId && getTemplate(d.templateId).category === c.id).length])),
      est: establishedYear(family),
      line: LINES[new Date().getDate() % LINES.length],
    };
  }, [ctx]);

  if (!ctx || !data) return null;
  const { family, viewer } = ctx;

  return (
    <Screen back={false} bottomInset={TAB_BAR_HEIGHT} testID="home">
      <View style={styles.top}>
        <View style={styles.flex}>
          <Nameplate name={family.name} est={data.est} onPress={() => setSwitcher(true)} testID="nameplate" />
        </View>
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={[styles.round, { backgroundColor: palette.surface, borderColor: palette.line }]}
        >
          <Icon name="Search" size={22} />
        </Pressable>
      </View>

      {family.isSample ? (
        <Card style={styles.sample}>
          <View style={styles.sampleRow}>
            <Stamp text="Sample" tone="stamp" />
            <T variant="small" color="ink2" style={styles.flex}>A made-up family to try things. Nothing here is real.</T>
          </View>
          <Pressy onPress={() => setViewAs(true)} testID="view-as" style={[styles.viewAs, { backgroundColor: palette.surfaceAlt }]}>
            <Avatar member={viewer} size={28} />
            <T variant="smallStrong" style={styles.flex}>Viewing as {displayName(viewer)}</T>
            <Icon name="ChevronDown" size={18} color="ink2" />
          </Pressy>
        </Card>
      ) : null}

      <View style={styles.greeting}>
        <T variant="title">Namaste, {firstName(viewer.fullName)}</T>
        <T variant="body" color="ink2">{data.line}</T>
      </View>

      <Pressy onPress={() => router.push('/search')} testID="home-search" style={[styles.search, { backgroundColor: palette.surface, borderColor: palette.line }]} accessibilityLabel="Search documents, numbers and people">
        <Icon name="Search" size={20} color="ink3" />
        <T variant="body" color="ink3">Search “pan”, “gaadi”, “bima”…</T>
      </Pressy>

      {data.attention.length > 0 ? (
        <Section
          title="Needs attention"
          action={
            <Pressable onPress={() => router.push('/reminders')} accessibilityRole="button" hitSlop={8}>
              <T variant="smallStrong" color="accent">See all</T>
            </Pressable>
          }
        >
          <Card padded={false}>
            {data.attention.slice(0, 4).map((a, i) => {
              const stamp = stampFor(a);
              const owner = a.ownerId ? findMember(family, a.ownerId) : undefined;
              const when = a.daysLeft < 0 ? relativeDays(a.daysLeft) : `due ${relativeDays(a.daysLeft)}`;
              return (
                <Row
                  key={a.key}
                  testID={`attention-${a.key}`}
                  title={a.title}
                  subtitle={owner ? `${displayName(owner)} · ${when}` : when}
                  icon={a.kind === 'task' ? 'ListTodo' : a.kind === 'doc' ? 'CalendarClock' : 'CreditCard'}
                  tint={stamp.tone === 'sindoor' ? 'sindoor' : stamp.tone === 'haldi' ? 'haldi' : 'stamp'}
                  divider={i > 0}
                  chevron={false}
                  right={<Stamp text={stamp.text} tone={stamp.tone} />}
                  onPress={() => router.push(attentionHref(a))}
                />
              );
            })}
          </Card>
        </Section>
      ) : (
        <Card style={styles.allClear}>
          <IconTile icon="CircleCheck" tint="almari" size={40} />
          <View style={styles.flex}>
            <T variant="bodyStrong">All clear</T>
            <T variant="small" color="ink2">Nothing expiring or due soon. Chai pi lijiye.</T>
          </View>
        </Card>
      )}

      {data.nudges.length ? (
        <Section title="Coming up for the family">
          <NudgeCards nudges={data.nudges} members={family.members} limit={2} />
        </Section>
      ) : null}

      <Section
        title="Family"
        action={
          <Pressable onPress={() => router.push('/member/new')} accessibilityRole="button" hitSlop={8}>
            <T variant="smallStrong" color="accent">Add</T>
          </Pressable>
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
          {data.people.map((m) => (
            <Pressy key={m.id} testID={`person-${m.id}`} onPress={() => router.push(`/person/${m.id}`)} style={styles.person} accessibilityLabel={`${m.fullName}${m.relation ? `, ${m.relation}` : ''}`}>
              <Avatar member={m} size={60} ring={m.id === viewer.id} />
              <T variant="smallStrong" numberOfLines={1} color={m.status === 'memorial' ? 'ink2' : 'ink'}>
                {m.id === viewer.id ? 'You' : displayName(m)}
              </T>
            </Pressy>
          ))}
        </ScrollView>
      </Section>

      {data.ready.done < data.ready.total ? (
        <Pressy onPress={() => router.push('/extras/readiness')} testID="readiness-card">
          <Card style={styles.ready}>
            <View style={styles.readyHead}>
              <T variant="bodyStrong" style={styles.flex}>{family.name}: {data.ready.done} of {data.ready.total} essentials saved</T>
              <Icon name="ChevronRight" size={20} color="ink3" />
            </View>
            <View style={[styles.bar, { backgroundColor: palette.surfaceAlt }]}>
              <View style={[styles.barFill, { width: `${Math.round((data.ready.done / Math.max(1, data.ready.total)) * 100)}%`, backgroundColor: palette.accent }]} />
            </View>
            <T variant="small" color="ink2">
              Next: {(() => {
                const gap = data.ready.items.find((i) => !i.done && !i.hidden);
                const who = gap?.memberId ? findMember(family, gap.memberId) : undefined;
                return gap ? `${who ? (who.id === viewer.id ? 'Your ' : `${displayName(who)}’s `) : ''}${gap.label}` : 'All done';
              })()}
            </T>
          </Card>
        </Pressy>
      ) : null}

      <Section title="Family papers" style={styles.sectionTop}>
        <View style={styles.grid}>
          {COMMON_CATEGORIES.map((c) => (
            <Tile
              key={c.id}
              testID={`category-${c.id}`}
              icon={c.icon}
              tint={c.tint}
              label={c.name}
              badge={data.counts[c.id] ? `${data.counts[c.id]} saved` : 'Empty'}
              onPress={() => router.push(`/category/${c.id}`)}
            />
          ))}
        </View>
      </Section>

      <Section title="Handy">
        <Card padded={false}>
          <Row title="Situation packs" subtitle="Hospital, bank KYC, school, exam form: one PDF" icon="Package" tint="inland" onPress={() => router.push('/extras/packs')} testID="handy-packs" />
          <Row title="Family ID sheet" subtitle="Everyone’s numbers on one page" icon="IdCard" tint="lifafa" divider onPress={() => router.push('/extras/id-sheet')} />
          <Row title="Emergency cards" subtitle="Blood group, allergies, medicines" icon="HeartPulse" tint="sindoor" divider onPress={() => router.push('/extras/emergency')} />
          <Row title="Where is the original?" subtitle="Every paper by where it is kept" icon="MapPin" tint="inland" divider onPress={() => router.push('/extras/places')} />
          <Row title="Money map" subtitle="Every account and policy, and its nominee" icon="PiggyBank" tint="haldi" divider onPress={() => router.push('/extras/money-map')} testID="handy-money" />
          <Row title="Print-ready sheet" subtitle="Cards at true size, front and back, on A4" icon="Download" tint="stamp" divider onPress={() => router.push('/extras/print-sheet')} testID="handy-print" />
          <Row title="Kaam ke numbers" subtitle="Doctor, CA, gas agency, electrician" icon="Phone" tint="haldi" divider onPress={() => router.push('/extras/contacts')} />
          <Row title="Recently deleted" subtitle="Kept for 30 days" icon="Trash" tint="almari" divider onPress={() => router.push('/settings/deleted')} />
        </Card>
      </Section>

      <FamilySwitcher visible={switcher} onClose={() => setSwitcher(false)} />
      <ViewAsSheet visible={viewAs} onClose={() => setViewAs(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  sample: { gap: space.md, marginBottom: space.lg },
  sampleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  viewAs: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.pill },
  greeting: { gap: 2, marginBottom: space.lg },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, marginBottom: space.xxl },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xxl },
  people: { gap: space.md, paddingVertical: space.xs },
  person: { alignItems: 'center', gap: 6, width: 72 },
  ready: { gap: space.sm, marginBottom: space.xxl },
  readyHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  sectionTop: {},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
