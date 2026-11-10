import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Bits';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { goBack, Screen, Section } from '@/components/Layout';
import { checkPhone, checkRequiredText } from '@/domain/validation';
import { useApp } from '@/store/app-store';
import { useCtx } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { space } from '@/theme/tokens';

const ROLES = ['Family doctor', 'CA', 'Lawyer', 'Insurance agent', 'Electrician', 'Plumber', 'Society office', 'Gas agency', 'Car mechanic'];

/** Kaam ke numbers: the diary that once sat beside the landline. */
export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useCtx();
  const saveContact = useApp((s) => s.saveContact);
  const deleteContact = useApp((s) => s.deleteContact);
  const c = ctx && id !== 'new' ? ctx.family.contacts.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(c?.name ?? '');
  const [role, setRole] = useState(c?.role ?? '');
  const [phone, setPhone] = useState(c?.phone ?? '+91 ');
  const [notes, setNotes] = useState(c?.notes ?? '');
  const [tried, setTried] = useState(false);
  if (!ctx) return <Redirect href="/" />;

  const checks = { name: checkRequiredText(name, 'Name', 60), phone: checkRequiredText(phone.replace('+91', ''), 'Number', 20) };
  const save = () => {
    setTried(true);
    if (checks.name.level === 'error' || checks.phone.level === 'error') return;
    saveContact({ id: c?.id, name: name.trim(), role: role.trim() || 'Other', phone: phone.trim(), notes: notes.trim() || undefined });
    toast('Number saved', { tone: 'success' });
    goBack();
  };

  return (
    <Screen title={c ? 'Edit number' : 'Kaam ka number'} footer={<Button label="Save" onPress={save} testID="contact-save" />} testID="contact">
      <TextField label="Name" value={name} onChangeText={setName} required check={checks.name} showCheck={tried} placeholder="Dr. Mehta" testID="contact-name" />
      <TextField label="Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" required check={checks.phone.level === 'error' ? checks.phone : checkPhone(phone)} showCheck={tried || phone.length > 6} testID="contact-phone" />
      <Section title="Who are they?">
        <View style={styles.chips}>
          {ROLES.map((r) => <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} />)}
        </View>
        <TextField label="Or type it" value={role} onChangeText={setRole} />
      </Section>
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline max={200} placeholder="Clinic timings, account number with them…" />
      {c ? (
        <Button
          label="Delete"
          icon="Trash"
          variant="danger"
          onPress={() => {
            deleteContact(c.id);
            toast('Deleted');
            goBack();
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
