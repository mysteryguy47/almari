import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Family, ID, Vehicle, VehicleKind } from '@/domain/types';
import { checkRequiredText } from '@/domain/validation';
import { checkPlate, normalisePlate, VEHICLE_KINDS } from '@/domain/vehicles';
import { haptic } from '@/lib/device';
import { useApp } from '@/store/app-store';
import { toast } from '@/store/ui-store';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { TextField, ToggleRow } from './Fields';
import { Section } from './Layout';
import { FAMILY, MemberPicker } from './MemberPicker';
import { NumberPlate } from './Marks';
import { Sheet } from './Sheet';
import { T } from './Text';
import { VehicleGlyph } from './VehicleGlyph';

/** Add a vehicle, or change one: what it is, what it is called, its number plate, whether it is electric, and whose name the RC is in. */
export function VehicleSheet({ visible, onClose, family, vehicle, onSaved }: {
  visible: boolean;
  onClose: () => void;
  family: Family;
  vehicle?: Vehicle;
  onSaved?: (id: ID) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={vehicle ? 'Edit vehicle' : 'Add a vehicle'} subtitle="Its RC, insurance, PUC and bills are kept together." testID="vehicle-sheet">
      {/* Inside the sheet, so each opening starts fresh. */}
      <VehicleForm family={family} vehicle={vehicle} onSaved={onSaved} onClose={onClose} />
    </Sheet>
  );
}

function VehicleForm({ family, vehicle, onSaved, onClose }: { family: Family; vehicle?: Vehicle; onSaved?: (id: ID) => void; onClose: () => void }) {
  const { palette } = useTheme();
  const saveVehicle = useApp((s) => s.saveVehicle);
  const [kind, setKind] = useState<VehicleKind>(vehicle?.kind ?? 'car');
  const [name, setName] = useState(vehicle?.name ?? '');
  const [number, setNumber] = useState(vehicle?.number ?? '');
  const [registeredTo, setRegisteredTo] = useState<ID | undefined>(vehicle?.registeredTo);
  const [electric, setElectric] = useState(vehicle?.electric ?? false);
  const [tried, setTried] = useState(false);
  const members = family.members.filter((m) => m.status !== 'memorial' && !m.isPet);
  const nameCheck = checkRequiredText(name, 'Name', 40);

  const save = () => {
    setTried(true);
    if (nameCheck.level === 'error') return;
    const id = saveVehicle({ id: vehicle?.id, kind, name: name.trim(), number: number.trim() ? normalisePlate(number) : undefined, registeredTo, electric, notes: vehicle?.notes });
    haptic.success();
    toast(vehicle ? 'Vehicle saved' : `${name.trim()} added. Its papers go here.`, { tone: 'success' });
    onSaved?.(id);
    onClose();
  };

  return (
    <View>
      <View style={styles.kinds} accessibilityRole="radiogroup">
        {VEHICLE_KINDS.map((k) => {
          const on = k.value === kind;
          return (
            <Pressable
              key={k.value}
              onPress={() => {
                haptic.tap();
                setKind(k.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={k.label}
              style={({ pressed }) => [
                styles.kind,
                { borderColor: on ? palette.accent : palette.line, backgroundColor: on ? palette.accentSoft : palette.surface },
                pressed && !on ? styles.pressed : null,
              ]}
              testID={`vehicle-kind-${k.value}`}
            >
              <VehicleGlyph kind={k.value} size={44} color={on ? palette.accent : palette.ink3} />
              <T variant={on ? 'smallStrong' : 'small'} color={on ? 'accent' : 'ink2'} numberOfLines={1}>{k.label}</T>
            </Pressable>
          );
        })}
      </View>
      <TextField label="What do you call it?" value={name} onChangeText={setName} placeholder={VEHICLE_KINDS.find((k) => k.value === kind)?.example} max={40} required check={nameCheck} showCheck={tried} testID="vehicle-name" />
      <TextField
        label="Number plate"
        value={number}
        onChangeText={(v) => setNumber(v.toUpperCase())}
        placeholder="DL 3C AB 1234"
        autoCapitalize="characters"
        check={checkPlate(number)}
        testID="vehicle-number"
        right={normalisePlate(number).length >= 6 ? <View style={styles.plate}><NumberPlate number={number} size="sm" /></View> : undefined}
      />
      <View style={styles.electric}>
        <ToggleRow title="Electric" subtitle="Electric vehicles need no PUC, so Almari won’t ask for one." value={electric} onValueChange={setElectric} testID="vehicle-electric" />
      </View>
      <Section title="RC in whose name?">
        <MemberPicker members={members} value={[registeredTo ?? FAMILY]} onChange={(v) => setRegisteredTo(v[0] === FAMILY ? undefined : v[0])} allowFamily familyLabel="Not sure" testID="vehicle-owner" />
      </Section>
      <Button label={vehicle ? 'Save' : 'Add vehicle'} onPress={save} testID="vehicle-save" />
    </View>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  kind: { width: '31.5%', flexGrow: 1, alignItems: 'center', paddingBottom: space.sm, borderRadius: radius.md, borderWidth: 1.2 },
  pressed: { opacity: 0.7 },
  plate: { marginLeft: space.sm },
  electric: { marginBottom: space.lg },
});
