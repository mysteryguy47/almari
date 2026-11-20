import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconTile, Stamp } from '@/components/Bits';
import { Button } from '@/components/Button';
import { DocThumb } from '@/components/DocThumb';
import { DeleteItem, NotFound } from '@/components/ItemBits';
import { Card, Row, Screen, Section, useLift } from '@/components/Layout';
import { DocMark, NumberPlate } from '@/components/Marks';
import { T } from '@/components/Text';
import { VehicleSheet } from '@/components/VehicleSheet';
import { displayName, findMember } from '@/domain/access';
import { daysUntil, formatDate, relativeDays } from '@/domain/dates';
import { listNumber } from '@/domain/money';
import { getTemplate, VEHICLE_ESSENTIALS } from '@/domain/templates';
import type { DocItem } from '@/domain/types';
import { mainFiles } from '@/domain/versions';
import { findVehicle, missingEssentials, vehicleAttention, vehicleDocs, vehicleIcon, vehicleKindLabel } from '@/domain/vehicles';
import { stampFor } from '@/lib/attention';
import { useCtx } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Papers about using the vehicle, and papers about looking after it. */
const UPKEEP = new Set(['service-record', 'vehicle-repair-bill', 'challan', 'vehicle-invoice', 'vehicle-warranty', 'loan-noc']);

function DocRow({ d, divider }: { d: DocItem; divider: boolean }) {
  const template = getTemplate(d.templateId);
  const days = d.expiryDate ? daysUntil(d.expiryDate) : null;
  const stamp = days !== null && days <= 30 ? stampFor({ daysLeft: days, kind: 'doc', date: d.expiryDate as string }) : null;
  const subtitle = d.expiryDate
    ? `${template.expiry?.label ?? 'Expires'} ${formatDate(d.expiryDate)}`
    : d.issueDate ? formatDate(d.issueDate) : listNumber(d.templateId, d.number) ?? template.name;
  return (
    <Row
      testID={`vdoc-${d.id}`}
      title={d.title}
      subtitle={subtitle}
      left={mainFiles(d)[0]?.kind === 'image' ? <DocThumb templateId={d.templateId} file={mainFiles(d)[0]} width={44} /> : <DocMark templateId={d.templateId} size={44} />}
      right={stamp ? <Stamp text={stamp.text} tone={stamp.tone} /> : undefined}
      divider={divider}
      onPress={() => router.push(`/doc/${d.id}`)}
    />
  );
}

/** One vehicle: its number plate, and every paper it needs, in one place. */
export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const { palette } = useTheme();
  const lift = useLift();
  const [editing, setEditing] = useState(false);

  if (!ctx) return <Redirect href="/" />;
  const { family, viewerId } = ctx;
  const vehicle = findVehicle(family, id);
  if (!vehicle) return <Screen title="Vehicle"><NotFound /></Screen>;

  const docs = vehicleDocs(family, viewerId, vehicle.id);
  const papers = docs.filter((d) => !UPKEEP.has(d.templateId));
  const upkeep = docs.filter((d) => UPKEEP.has(d.templateId)).sort((a, b) => (b.issueDate ?? '').localeCompare(a.issueDate ?? '') || b.createdAt - a.createdAt);
  const missing = missingEssentials(docs);
  const attention = vehicleAttention(docs);
  const owner = findMember(family, vehicle.registeredTo);
  const add = (template?: string) => router.push({ pathname: '/doc/new', params: template ? { template, vehicle: vehicle.id } : { category: 'vehicles', vehicle: vehicle.id } });

  return (
    <Screen
      title={vehicle.name}
      subtitle={vehicleKindLabel(vehicle.kind)}
      right={<Pressable onPress={() => setEditing(true)} accessibilityRole="button" hitSlop={8} testID="vehicle-edit"><T variant="smallStrong" color="accent">Edit</T></Pressable>}
      testID="vehicle-view"
    >
      <View style={[styles.hero, { backgroundColor: palette.surface, borderColor: palette.line }, lift]}>
        <IconTile icon={vehicleIcon(vehicle.kind)} tint="inland" size={56} />
        <View style={styles.heroText}>
          {vehicle.number ? <NumberPlate number={vehicle.number} size="lg" /> : <T variant="body" color="ink3">No number plate yet</T>}
          <T variant="small" color="ink2">{owner ? `RC in ${owner.id === viewerId ? 'your' : `${displayName(owner)}’s`} name` : 'For the whole family'} · {docs.length} {docs.length === 1 ? 'paper' : 'papers'}</T>
        </View>
      </View>

      {attention ? (
        <Card style={[styles.alert, { backgroundColor: attention.days < 0 ? palette.sindoorSoft : palette.haldiSoft, borderColor: 'transparent' }]}>
          <T variant="bodyStrong" color={attention.days < 0 ? 'sindoor' : 'haldi'}>
            {attention.doc.title} {attention.days < 0 ? 'has expired' : `is due ${relativeDays(attention.days)}`}
          </T>
          <T variant="small" color="ink2">{getTemplate(attention.doc.templateId).expiry?.label} {formatDate(attention.doc.expiryDate as string)}. Renew it and add the new copy to keep the reminder going.</T>
        </Card>
      ) : null}

      <Section title="Papers">
        <Card padded={false}>
          {papers.map((d, i) => <DocRow key={d.id} d={d} divider={i > 0} />)}
          {VEHICLE_ESSENTIALS.filter((t) => missing.includes(t)).map((t, i) => (
            <Row
              key={t}
              testID={`vadd-${t}`}
              title={`Add the ${t === 'rc' ? 'RC' : t === 'puc' ? 'PUC' : getTemplate(t).name.toLowerCase()}`}
              subtitle={t === 'rc' ? 'Front and back' : t === 'puc' ? 'Reminds before it runs out' : 'Reminds before renewal'}
              left={<DocMark templateId={t} size={44} />}
              right={<T variant="smallStrong" color="accent">Add</T>}
              chevron={false}
              divider={papers.length + i > 0}
              onPress={() => add(t)}
            />
          ))}
          {!papers.length && !missing.length ? <Row title="No papers yet" /> : null}
        </Card>
      </Section>

      <Section title="Service and bills">
        <Card padded={false}>
          {upkeep.map((d, i) => <DocRow key={d.id} d={d} divider={i > 0} />)}
          <Row title="Add a service record" left={<DocMark templateId="service-record" size={44} />} right={<T variant="smallStrong" color="accent">Add</T>} chevron={false} divider={upkeep.length > 0} onPress={() => add('service-record')} testID="vadd-service" />
          <Row title="Add a repair or parts bill" left={<DocMark templateId="vehicle-repair-bill" size={44} />} right={<T variant="smallStrong" color="accent">Add</T>} chevron={false} divider onPress={() => add('vehicle-repair-bill')} testID="vadd-bill" />
        </Card>
      </Section>

      <Button label={`Another paper for ${vehicle.name}`} icon="Plus" variant="secondary" onPress={() => add()} testID="vadd-any" />
      <T variant="small" color="ink3" style={styles.note}>FASTag, road tax, the purchase invoice, warranty, loan NOC and challans can all be kept here.</T>

      <DeleteItem collection="vehicles" id={vehicle.id} title={vehicle.name} />
      <T variant="small" color="ink3" style={styles.note}>Deleting the vehicle keeps its papers. They move to Vehicles, not under any vehicle.</T>

      <VehicleSheet visible={editing} onClose={() => setEditing(false)} family={family} vehicle={vehicle} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.xl },
  heroText: { flex: 1, gap: space.sm },
  alert: { gap: 4, marginBottom: space.xl },
  note: { marginTop: space.sm },
});
