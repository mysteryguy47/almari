import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Card, Screen } from '@/components/Layout';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { useAccount } from '@/store/hooks';
import { toast } from '@/store/ui-store';
import { deleteAccount } from '@/sync/actions';
import { space } from '@/theme/tokens';

/** Account deletion inside the app, as Google Play requires (a web page does the same for people without the app). */
export default function DeleteAccount() {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!account) return <Redirect href="/" />;
  return (
    <Screen title="Delete account" testID="delete-account">
      <Card style={styles.card}>
        <T variant="bodyStrong">What happens</T>
        <T variant="body" color="ink2">• You leave every family you are in ({account.familyIds.length}).</T>
        <T variant="body" color="ink2">• Your own personal papers, passwords and cards are deleted.</T>
        <T variant="body" color="ink2">• The family’s common papers stay with the family.</T>
        <T variant="body" color="ink2">• A family with no one else signed in is deleted completely, files and all.</T>
        <T variant="body" color="ink2">• Your sign-in, keys and devices are removed from our server.</T>
        <T variant="body" color="ink2">• This cannot be undone.</T>
      </Card>
      <T variant="small" color="ink2" style={styles.note}>Need any paper? Share or save it first: after this, nobody can recover it.</T>
      {error ? <T variant="smallStrong" color="sindoor" style={styles.note}>{error}</T> : null}
      {busy ? (
        <ActivityIndicator />
      ) : (
        <SlideToConfirm
          label="Slide to delete everything"
          tone="sindoor"
          testID="slide-delete-account"
          onConfirm={async () => {
            setBusy(true);
            const result = await deleteAccount();
            setBusy(false);
            if (!result.ok) return setError(result.error);
            toast('Your account was deleted');
            router.replace('/welcome');
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginBottom: space.lg },
  note: { marginBottom: space.xl },
});
