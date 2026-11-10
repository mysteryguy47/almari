import { Redirect, router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Card, Screen } from '@/components/Layout';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { T } from '@/components/Text';
import { useApp } from '@/store/app-store';
import { useAccount } from '@/store/hooks';
import { toast, useUi } from '@/store/ui-store';
import { space } from '@/theme/tokens';

/** Account deletion inside the app, as Google Play requires (a web page does the same for people without the app). */
export default function DeleteAccount() {
  const account = useAccount();
  const deleteAccount = useApp((s) => s.deleteAccount);
  if (!account) return <Redirect href="/" />;
  return (
    <Screen title="Delete account" testID="delete-account">
      <Card style={styles.card}>
        <T variant="bodyStrong">What happens</T>
        <T variant="body" color="ink2">• You leave every family you are in ({account.familyIds.length}).</T>
        <T variant="body" color="ink2">• Your own personal papers, passwords and cards are deleted.</T>
        <T variant="body" color="ink2">• The family’s common papers stay with the family.</T>
        <T variant="body" color="ink2">• A family with no one else signed in is deleted completely.</T>
        <T variant="body" color="ink2">• This cannot be undone.</T>
      </Card>
      <T variant="small" color="ink2" style={styles.note}>Consider exporting first. (Export to a folder of readable files comes with the full app.)</T>
      <SlideToConfirm
        label="Slide to delete everything"
        tone="sindoor"
        testID="slide-delete-account"
        onConfirm={() => {
          deleteAccount();
          useUi.getState().lock();
          toast('Your account was deleted');
          router.replace('/welcome');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginBottom: space.lg },
  note: { marginBottom: space.xl },
});
