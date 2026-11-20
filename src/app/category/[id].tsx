import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconTile, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { DocThumb } from '@/components/DocThumb';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen, Section, useLift } from '@/components/Layout';
import { DocMark, NumberPlate } from '@/components/Marks';
import { Pressy } from '@/components/Pressy';
import { T } from '@/components/Text';
import { VehicleSheet } from '@/components/VehicleSheet';
import { displayName, findMember, visibleTo } from '@/domain/access';
import { daysUntil, formatDate, relativeDays } from '@/domain/dates';
import { listNumber } from '@/domain/money';
import { getCategory, getTemplate, templatesIn, type CategoryId } from '@/domain/templates';
import type { DocItem, Family, ID } from '@/domain/types';
import { mainFiles } from '@/domain/versions';
import { looseVehicleDocs, missingEssentials, vehicleAttention, vehicleDocs, vehicleIcon, vehiclesOf } from '@/domain/vehicles';
import { stampFor } from '@/lib/attention';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

function DocList({ docs, family }: { docs: DocItem[]; family: Family }) {
  return (
    <Card padded={false}>
      {docs.map((d, i) => {
        const days = d.expiryDate ? daysUntil(d.expiryDate) : null;
        const stamp = days !== null && days <= 30 ? stampFor({ daysLeft: days, kind: 'doc', date: d.expiryDate as string }) : null;
        const owner = d.ownerId ? findMember(family, d.ownerId) : undefined;
        return (
          <Row
            key={d.id}
            testID={`doc-${d.id}`}
            title={d.title}
            subtitle={[owner ? displayName(owner) : null, d.expiryDate ? `${getTemplate(d.templateId).expiry?.label ?? 'Expires'} ${formatDate(d.expiryDate)}` : listNumber(d.templateId, d.number)].filter(Boolean).join(' · ')}
            left={<DocThumb templateId={d.templateId} file={mainFiles(d)[0]} width={44} />}
            divider={i > 0}
            right={stamp ? <Stamp text={stamp.text} tone={stamp.tone} /> : d.onlyMe ? <Stamp text="Only me" /> : undefined}
            onPress={() => router.push(`/doc/${d.id}`)}
          />
        );
      })}
    </Card>
  );
}

/** What can be added here, as a quiet list: a tick for what is saved, a plus for what is not. */
function AddList({ category, saved, params }: { category: CategoryId; saved: Set<string>; params?: Record<string, string> }) {
  return (
    <Card padded={false}>
      {templatesIn(category).map((t, i) => (
        <Row
          key={t.id}
          testID={`add-${t.id}`}
          title={t.name}
          left={<DocMark templateId={t.id} size={36} />}
          right={<Icon name={saved.has(t.id) ? 'CircleCheck' : 'Plus'} size={20} color={saved.has(t.id) ? 'almari' : 'accent'} />}
          chevron={false}
          divider={i > 0}
          onPress={() => router.push({ pathname: '/doc/new', params: { template: t.id, ...params } })}
        />
      ))}
    </Card>
  );
}

function VehicleCard({ family, viewerId, id }: { family: Family; viewerId: ID; id: ID }) {
  const { palette } = useTheme();
  const lift = useLift();
  const vehicle = vehiclesOf(family).find((v) => v.id === id);
  if (!vehicle) return null;
  const docs = vehicleDocs(family, viewerId, vehicle.id);
  const attention = vehicleAttention(docs);
  const missing = missingEssentials(docs);
  const line = attention
    ? `${getTemplate(attention.doc.templateId).short ?? attention.doc.title} ${attention.days < 0 ? 'expired' : `due ${relativeDays(attention.days)}`}`
    : missing.length ? `${missing.length === 3 ? 'No papers yet' : `${docs.length} ${docs.length === 1 ? 'paper' : 'papers'}, ${missing.map((m) => getTemplate(m).short).join(' and ')} not added`}`
      : `${docs.length} papers, all in order`;
  return (
    <Pressy onPress={() => router.push(`/vehicle/${vehicle.id}`)} accessibilityLabel={`${vehicle.name}. ${line}`} testID={`vehicle-${vehicle.id}`} style={[styles.vehicle, { backgroundColor: palette.surface, borderColor: palette.line }, lift]}>
      <IconTile icon={vehicleIcon(vehicle.kind)} tint="inland" size={48} />
      <View style={styles.vehicleText}>
        <T variant="bodyStrong" numberOfLines={1}>{vehicle.name}</T>
        {vehicle.number ? <NumberPlate number={vehicle.number} size="sm" /> : null}
        <T variant="small" color={attention ? (attention.days < 0 ? 'sindoor' : 'haldi') : 'ink2'} numberOfLines={1}>{line}</T>
      </View>
      <Icon name="ChevronRight" size={20} color="ink3" />
    </Pressy>
  );
}

function Vehicles({ family, viewerId }: { family: Family; viewerId: ID }) {
  const fileUnderVehicle = useApp((s) => s.fileUnderVehicle);
  const [adding, setAdding] = useState(false);
  const vehicles = vehiclesOf(family);
  const loose = looseVehicleDocs(family, viewerId);
  const saved = new Set(loose.map((d) => d.templateId));
  return (
    <>
      {vehicles.length ? (
        <View style={styles.vehicles}>
          {vehicles.map((v) => <VehicleCard key={v.id} family={family} viewerId={viewerId} id={v.id} />)}
        </View>
      ) : (
        <Card style={styles.empty}>
          <T variant="bodyStrong">Add each vehicle once</T>
          <T variant="small" color="ink2">The car, the scooter, the tractor: each keeps its own RC, insurance, PUC, service record and bills, and reminds before anything runs out.</T>
        </Card>
      )}
      <Button label={vehicles.length ? 'Add another vehicle' : 'Add a vehicle'} icon="Plus" variant={vehicles.length ? 'secondary' : 'primary'} onPress={() => setAdding(true)} testID="vehicle-add" />

      {loose.length ? (
        <Section title="Not under a vehicle yet" style={styles.loose}>
          <DocList docs={loose} family={family} />
          {vehicles.length === 1 ? (
            <Button
              label={`File ${loose.length === 1 ? 'it' : `all ${loose.length}`} under ${vehicles[0].name}`}
              icon="Folder"
              variant="ghost"
              onPress={() => {
                fileUnderVehicle(loose.map((d) => d.id), vehicles[0].id);
                toast(`Filed under ${vehicles[0].name}`, { tone: 'success' });
              }}
              testID="file-loose"
            />
          ) : (
            <T variant="small" color="ink3" style={styles.hint}>{vehicles.length ? 'Open one and edit it to pick its vehicle.' : 'Add the vehicle, and an RC with the same number files itself.'}</T>
          )}
        </Section>
      ) : null}

      {!vehicles.length ? (
        <Section title="Or add a paper" style={styles.loose}>
          <AddList category="vehicles" saved={saved} />
        </Section>
      ) : null}
      <VehicleSheet visible={adding} onClose={() => setAdding(false)} family={family} onSaved={(id) => router.push(`/vehicle/${id}`)} />
    </>
  );
}

/** One category's papers, e.g. Health: prescriptions, reports. Vehicles show each vehicle instead. */
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
  const saved = new Set(docs.map((d) => d.templateId));
  const vehicles = category.id === 'vehicles';
  const count = vehicles ? vehiclesOf(ctx.family).length : docs.length;

  return (
    <Screen title={category.name} subtitle={category.scope === 'common' ? 'Shared with the whole family' : 'Personal papers'} testID="category">
      <View style={styles.head}>
        <IconTile icon={category.icon} tint={category.tint} size={56} />
        <T variant="body" color="ink2" style={styles.flex}>
          {vehicles
            ? count ? `${count} ${count === 1 ? 'vehicle' : 'vehicles'}, ${docs.length} ${docs.length === 1 ? 'paper' : 'papers'}` : 'No vehicles yet.'
            : docs.length ? `${docs.length} saved` : 'Nothing saved here yet.'}
        </T>
      </View>
      {vehicles ? (
        <Vehicles family={ctx.family} viewerId={ctx.viewerId} />
      ) : (
        <>
          {docs.length ? <DocList docs={docs} family={ctx.family} /> : null}
          <Section title="Add" style={styles.add}>
            <AddList category={category.id as CategoryId} saved={saved} />
          </Section>
          <Button label="Something else" variant="ghost" icon="Plus" onPress={() => router.push({ pathname: '/doc/new', params: { template: 'custom' } })} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  add: { marginTop: space.xxl },
  vehicles: { gap: space.md, marginBottom: space.lg },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  vehicleText: { flex: 1, gap: 6, alignItems: 'flex-start' },
  empty: { gap: space.sm, marginBottom: space.lg },
  loose: { marginTop: space.xxl },
  hint: { marginTop: space.sm },
});
