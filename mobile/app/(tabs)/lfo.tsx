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
import { SafeAreaView } from "react-native-safe-area-context";
import { createLfo, getLfo, listFarms, listLfos, updateLfoInventory } from "../../src/repos/data";
import { todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
  SectionTitle,
} from "../../src/components/ui";

export default function LfoScreen() {
  const router = useRouter();
  const [lfos, setLfos] = useState(listLfos());
  const [farms] = useState(listFarms().farms);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReturnType<typeof getLfo> | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waterGal, setWaterGal] = useState("");
  const [headCount, setHeadCount] = useState("");

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

  const water = Number(waterGal) || 0;
  const heads = Number(headCount) || 0;
  const estimatedRate = water > 0 && heads > 0 ? (water * 8.34) / heads : null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          title="LFO"
          subtitle="Last feed order inventory and consumption rate"
        />

        <Text style={styles.label}>New LFO — farm</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {farms.map((f) => (
              <Chip
                key={f.id}
                label={f.farmName}
                active={farmId === f.id}
                onPress={() => setFarmId(f.id)}
              />
            ))}
          </View>
        </ScrollView>
        <PrimaryButton
          label="Create LFO for today"
          onPress={() => {
            if (!farmId) return;
            setLoading(true);
            const { id } = createLfo(farmId, todayKey());
            setSelectedId(id);
            setDetail(getLfo(id));
            setLfos(listLfos());
            setMsg("Created LFO");
            setLoading(false);
          }}
        />

        {msg ? (
          <Text style={{ color: colors.accentDark, marginTop: 8, fontWeight: "700" }}>{msg}</Text>
        ) : null}

        <SectionTitle>Saved LFOs</SectionTitle>
        {lfos.length === 0 ? (
          <Card>
            <Text style={styles.muted}>None yet</Text>
          </Card>
        ) : null}
        {lfos.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => {
              setSelectedId(l.id);
              setDetail(getLfo(l.id));
            }}
          >
            <Card
              style={
                selectedId === l.id
                  ? { borderColor: colors.accent, borderWidth: 2 }
                  : undefined
              }
            >
              <Text style={{ fontWeight: "800" }}>
                {l.farmName} · {l.orderDate}
              </Text>
            </Card>
          </Pressable>
        ))}

        {detail ? (
          <View style={{ marginTop: 4 }}>
            <SectionTitle>
              {detail.farmName} · {detail.orderDate}
            </SectionTitle>
            {detail.houses.map((h, idx) => (
              <Card key={h.id}>
                <Text style={{ fontWeight: "800", marginBottom: 8 }}>House {h.houseNumber}</Text>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
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
                  </View>
                  <View style={{ flex: 1 }}>
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
                </View>
              </Card>
            ))}
            <PrimaryButton
              label="Save inventory"
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
                setMsg("Inventory saved");
              }}
            />
          </View>
        ) : null}

        <SectionTitle>Consumption rate calculator</SectionTitle>
        <Card>
          <Text style={styles.label}>Daily water (gal)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={waterGal}
            onChangeText={setWaterGal}
            placeholder="0"
          />
          <Text style={styles.label}>Current head count</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={headCount}
            onChangeText={setHeadCount}
            placeholder="0"
          />
          <Text style={{ fontWeight: "800", fontSize: 16 }}>
            {estimatedRate != null
              ? `${estimatedRate.toFixed(3)} lbs / bird / day`
              : "Enter water and head count"}
          </Text>
        </Card>

        <Pressable style={{ marginTop: 16 }} onPress={() => router.push("/(tabs)/reports")}>
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>Open reports →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
