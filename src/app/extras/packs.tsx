import { Redirect, router } from 'expo-router';

import { Card, Row, Screen } from '@/components/Layout';
import { T } from '@/components/Text';
import { PACKS } from '@/domain/packs';
import { useCtx } from '@/store/hooks';

/** Situation packs: what a moment of need asks for, gathered and shared as one PDF. */
export default function Packs() {
  const ctx = useCtx();
  if (!ctx) return <Redirect href="/" />;
  return (
    <Screen title="Situation packs" subtitle="One tap, one PDF, for the moment of need" testID="packs">
      <T variant="body" color="ink2" style={{ marginBottom: 16 }}>
        Pick a moment and a person. Almari shows what is ready and what is missing, then shares it all as one PDF.
      </T>
      <Card padded={false}>
        {PACKS.map((p, i) => (
          <Row key={p.id} testID={`pack-${p.id}`} title={p.name} subtitle={p.line} icon={p.icon} tint="inland" divider={i > 0} onPress={() => router.push(`/extras/pack/${p.id}`)} />
        ))}
      </Card>
    </Screen>
  );
}
