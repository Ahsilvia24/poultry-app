import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { createLfo, getLfo, listFarms, listLfos, updateLfoInventory } from "../../src/repos/data";
import { todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";

export default function LfoScreen() {
  const router = useRouter();
  const [lfos, setLfos] = useState(listLfos());
  const [farms] = useState(listFarms().farms);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReturnType<typeof getLfo> | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLfos(listLfos());
    if (selectedId) {
      try {
        setDetail(getLfo(selectedId));
      } catch {
        setDetail(null);
      }
    }
  }, [selectedId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.subtitle}>Last Feed Order · offline</Text>

      <Text style={styles.label}>New LFO — farm</Text>
      <View style={[styles.row, { marginBottom: 8 }]}>
        {farms.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFarmId(f.id)}
            style={[
              styles.button,
              styles.buttonSecondary,
              { minHeight: 40, paddingHorizontal: 10 },
              farmId === f.id ? { backgroundColor: colors.accent } : null,
            ]}
          >
            <Text
              style={[
                styles.buttonSecondaryText,
                farmId === f.id ? { color: "#fff" } : null,
                { fontSize: 13 },
              ]}
            >
              {f.farmName}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={styles.button}
        onPress={() => {
          if (!farmId) return;
          setLoading(true);
          const { id } = createLfo(farmId, todayKey());
          setSelectedId(id);
          setDetail(getLfo(id));
          setLfos(listLfos());
          setMsg("Created LFO on this phone");
          setLoading(false);
        }}
      >
        <Text style={styles.buttonText}>Create LFO for today</Text>
      </Pressable>

      {msg ? <Text style={{ color: colors.accentDark, marginTop: 8, fontWeight: "700" }}>{msg}</Text> : null}

      <Text style={[styles.title, { fontSize: 18, marginTop: 20 }]}>Saved LFOs</Text>
      {lfos.length === 0 ? <Text style={styles.muted}>None yet</Text> : null}
      {lfos.map((l) => (
        <Pressable
          key={l.id}
          style={styles.card}
          onPress={() => {
            setSelectedId(l.id);
            setDetail(getLfo(l.id));
          }}
        >
          <Text style={{ fontWeight: "800" }}>
            {l.farmName} · {l.orderDate}
          </Text>
        </Pressable>
      ))}

      {detail ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.title, { fontSize: 18 }]}>
            {detail.farmName} · {detail.orderDate}
          </Text>
          {detail.houses.map((h, idx) => (
            <View key={h.id} style={styles.card}>
              <Text style={{ fontWeight: "800" }}>House {h.houseNumber}</Text>
              <Text style={styles.label}>Bin A lbs</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={String(h.binAPounds)}
                onChangeText={(v) => {
                  const n = Number(v) || 0;
                  setDetail((prev) => {
                    if (!prev) return prev;
                    const houses = [...prev.houses];
                    houses[idx] = { ...houses[idx]!, binAPounds: n };
                    return { ...prev, houses };
                  });
                }}
              />
              <Text style={styles.label}>Bin B lbs</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={String(h.binBPounds)}
                onChangeText={(v) => {
                  const n = Number(v) || 0;
                  setDetail((prev) => {
                    if (!prev) return prev;
                    const houses = [...prev.houses];
                    houses[idx] = { ...houses[idx]!, binBPounds: n };
                    return { ...prev, houses };
                  });
                }}
              />
            </View>
          ))}
          <Pressable
            style={styles.button}
            onPress={() => {
              if (!detail) return;
              updateLfoInventory(
                detail.houses.map((h) => ({
                  id: h.id,
                  binAPounds: h.binAPounds,
                  binBPounds: h.binBPounds,
                  feedUpAt: h.feedUpAt,
                  consumptionRate: h.consumptionRate,
                })),
              );
              setMsg("Inventory saved on this phone");
            }}
          >
            <Text style={styles.buttonText}>Save inventory</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable style={{ marginTop: 24 }} onPress={() => router.push("/(tabs)/reports")}>
        <Text style={{ color: colors.accent, fontWeight: "700" }}>Open reports →</Text>
      </Pressable>
    </ScrollView>
  );
}
