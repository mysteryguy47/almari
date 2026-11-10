/**
 * "Riya wants to open Almari on a new phone": shown on every device of the
 * family that can help, with the six symbols to compare before approving.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp } from '@/store/app-store';
import { useDeviceReady } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { approveDevice, declineDevice, personName } from '@/sync/actions';
import { useDeviceRequests } from '@/sync/runtime';
import { space } from '@/theme/tokens';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { Symbols } from './Symbols';
import { T } from './Text';

export function DeviceRequestsHost() {
  const requests = useDeviceRequests((s) => s.requests);
  const refresh = useDeviceRequests((s) => s.refresh);
  const ready = useDeviceReady();
  const userId = useApp((s) => s.cloud?.userId);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const request = ready ? requests.find((r) => !dismissed.includes(r.id)) : undefined;
  if (!request) return null;
  const own = request.user_id === userId;
  const who = personName(request.user_id);

  const approve = async () => {
    setBusy(true);
    const result = await approveDevice(request);
    setBusy(false);
    if (!result.ok) toast(result.error, { tone: 'warn' });
    setDismissed((d) => [...d, request.id]);
    void refresh();
  };
  const decline = async () => {
    setDismissed((d) => [...d, request.id]);
    await declineDevice(request);
    void refresh();
  };

  return (
    <Sheet
      visible
      onClose={() => setDismissed((d) => [...d, request.id])}
      title={own ? 'Let your new device in?' : `Let ${who}’s new device in?`}
      subtitle={`${request.device_name} is asking to open Almari.`}
      testID="device-request"
    >
      <View style={styles.body}>
        <T variant="body" color="ink2">
          {own
            ? 'Look at the new device. If it shows these same six symbols, approve. If you did not just sign in somewhere, decline.'
            : `Call ${who} first. Their screen should show these same six symbols. Approving gives that device the family’s papers.`}
        </T>
        <Symbols publicKey={request.public_key} testID="request-symbols" />
        {!own ? <T variant="small" color="ink3">Their Only me items stay locked until they use their Recovery Kit.</T> : null}
        <Button label="They match, approve" icon="ShieldCheck" onPress={approve} loading={busy} testID="approve-device" />
        <Button label="Not me, decline" variant="secondary" onPress={decline} testID="decline-device" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
});
