import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { IconName } from '@/domain/icons';
import type { Tint } from '@/domain/templates';
import { useUi } from '@/store/ui-store';
import { space } from '@/theme/tokens';

import { IconTile } from './Bits';
import { Pressy } from './Pressy';
import { Sheet } from './Sheet';
import { T } from './Text';

const OPTIONS: { label: string; hint: string; icon: IconName; tint: Tint; href: Href }[] = [
  { label: 'Document', hint: 'Aadhaar, PAN, RC, policy…', icon: 'FileText', tint: 'lifafa', href: '/doc/new' },
  { label: 'Task', hint: 'With a deadline', icon: 'ListTodo', tint: 'almari', href: '/task/new' },
  { label: 'Password or Wi-Fi', hint: 'Netflix, IRCTC, router', icon: 'KeyRound', tint: 'stamp', href: '/login/new' },
  { label: 'Bank account', hint: 'Number, IFSC, nominee', icon: 'Landmark', tint: 'haldi', href: '/bank/new' },
  { label: 'Card', hint: 'Credit or debit', icon: 'CreditCard', tint: 'inland', href: '/card/new' },
  { label: 'Secure note', hint: 'Locker number, PUK codes', icon: 'StickyNote', tint: 'stamp', href: '/note/new' },
  { label: 'Family member', hint: 'Or a pet', icon: 'UserPlus', tint: 'almari', href: '/member/new' },
  { label: 'Kaam ka number', hint: 'Doctor, CA, plumber', icon: 'Phone', tint: 'sindoor', href: '/contact/new' },
];

/** "What are you adding?" The big + in the middle of the tab bar. */
export function AddSheet() {
  const open = useUi((s) => s.addOpen);
  const setOpen = useUi((s) => s.setAddOpen);
  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <Sheet visible={open} onClose={() => setOpen(false)} title="What are you adding?" testID="add-sheet">
      <View style={styles.grid}>
        {OPTIONS.map((o) => (
          <Pressy key={o.label} testID={`add-${o.label}`} onPress={() => go(o.href)} outerStyle={styles.itemOuter} style={styles.item} accessibilityLabel={o.label} hapticOnPress>
            <IconTile icon={o.icon} tint={o.tint} size={52} />
            <T variant="smallStrong" align="center" numberOfLines={2}>{o.label}</T>
            <T variant="small" color="ink2" align="center" numberOfLines={2}>{o.hint}</T>
          </Pressy>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between', paddingBottom: space.md },
  itemOuter: { width: '47%' },
  item: { alignItems: 'center', gap: 4, paddingVertical: space.md },
});
