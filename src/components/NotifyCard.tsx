import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { NOTIFY_AVAILABLE, notifyStatus, turnOnNotifications, type NotifyStatus } from '@/lib/notify';
import { space } from '@/theme/tokens';

import { Button } from './Button';
import { Card, Row } from './Layout';

/** Whether this phone shows reminders as notifications, and the way to turn them on. Android only. */
export function NotifyCard() {
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!NOTIFY_AVAILABLE) return;
    const check = () => {
      notifyStatus().then(setStatus).catch(() => undefined);
    };
    check();
    // Coming back from the system settings: show what was chosen there.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);

  if (!NOTIFY_AVAILABLE || !status) return null;
  const on = status === 'on';
  return (
    <Card padded={false} style={styles.card}>
      <Row
        title={on ? 'Phone notifications are on' : 'Phone notifications are off'}
        subtitle={on ? 'Quiet hours 10 pm to 8 am. They name the paper or task, never its number.' : 'Turn them on to hear about expiries, bills and tasks even when Almari is closed.'}
        icon={on ? 'Bell' : 'BellOff'}
        tint={on ? 'almari' : 'haldi'}
        testID="notify-status"
      />
      {!on ? (
        <View style={styles.action}>
          <Button
            label={status === 'blocked' ? 'Open settings' : 'Turn on'}
            variant="secondary"
            size="md"
            loading={busy}
            testID="notify-turn-on"
            onPress={async () => {
              setBusy(true);
              try {
                setStatus(await turnOnNotifications());
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.xxl },
  action: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});
