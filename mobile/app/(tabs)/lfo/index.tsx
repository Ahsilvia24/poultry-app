import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { createLfo, deleteLfo, getLfo, listFarms, listLfos } from "../../../src/repos/data";
import { shareLfoPdf } from "../../../src/lib/reports/shareLfoPdf";
import { SharePdfIconButton } from "../../../src/components/SharePdfIconButton";
import { todayKey } from "../../../src/lib/ids";
import { currentHalfHourTime } from "../../../src/lib/time-slots";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { useExclusiveSwipeables } from "../../../src/lib/useExclusiveSwipeables";
import { ConfirmDialog } from "../../../src/components/ConfirmDialog";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  PageHeader,
  PrimaryButton,
} from "../../../src/components/ui";
import { CopyHouseSummaryButton } from "../../../src/components/LfoHouseSummaryBlock";
import { LfoFarmTabs, MANUAL_LFO_TAB_ID } from "../../../src/components/LfoFarmTabs";
import { ManualLfoScreen } from "../../../src/components/ManualLfoScreen";
import { lfoTabFromRoute } from "../../../src/lib/lfo/defaultTab";
import { userFacingMessage } from "../../../src/lib/useKeyboardInset";

/** "2026-07-26" → "7-26-2026" (no leading zeros). */
function formatLfoDate(dateKey: string) {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

async function shareSavedLfo(id: string) {
  const detail = getLfo(id);
  await shareLfoPdf({
    farmName: detail.farmName,
    orderDate: detail.orderDate.slice(0, 10),
    orderTime: detail.orderTime,
    consumptionRate: detail.consumptionRate,
    calculatedAt: detail.calculatedAt,
    notes: detail.notes,
    houses: detail.houses.map((house) => ({
      houseId: house.houseId,
      houseNumber: house.houseNumber,
      headCount: house.headCount,
      binAPounds: house.binAPounds,
      binBPounds: house.binBPounds,
      feedUpAt: house.feedUpAt,
    })),
  });
}

function SavedLfoList({
  lfos,
  onOpen,
  onDelete,
  onShareError,
}: {
  lfos: ReturnType<typeof listLfos>;
  onOpen: (id: string) => void;
  onDelete: (id: string, farmName: string) => void;
  onShareError?: (message: string) => void;
}) {
  const swipe = useExclusiveSwipeables();
  return (
    <>
      <View style={{ marginTop: 20, marginBottom: 10 }}>
        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 4 }]}>
          Saved LFOs
        </Text>
        <Text
          style={{
            fontSize: 11,
            lineHeight: 14,
            color: colors.muted,
            fontWeight: "600",
          }}
        >
          Rounds up to nearest 500 & adds 2000
        </Text>
        <Text
          style={{
            fontSize: 11,
            lineHeight: 14,
            color: colors.muted,
            fontWeight: "600",
          }}
        >
          Reclaim rounds to nearest 500
        </Text>
      </View>
      {lfos.length === 0 ? (
        <Card>
          <Text style={styles.muted}>None yet — create one above.</Text>
        </Card>
      ) : null}
      {lfos.map((l) => (
        <Swipeable
          key={l.id}
          ref={swipe.setRef(l.id)}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
          containerStyle={{ marginBottom: 12 }}
          onSwipeableWillOpen={() => swipe.closeOthers(l.id)}
          renderRightActions={() => (
            <Pressable
              accessibilityLabel={`Delete LFO for ${l.farmName}`}
              onPress={() => onDelete(l.id, l.farmName)}
              style={{
                backgroundColor: colors.danger,
                justifyContent: "center",
                alignItems: "center",
                width: 88,
                borderRadius: 14,
                marginLeft: 8,
              }}
            >
              <Ionicons name="trash-outline" size={22} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "800",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                Delete
              </Text>
            </Pressable>
          )}
        >
          <Card style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
            <Pressable
              onPress={() => onOpen(l.id)}
              accessibilityRole="button"
              accessibilityLabel={`Edit LFO for ${l.farmName}`}
              style={({ pressed }) => ({
                padding: 16,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: "800" }} numberOfLines={1}>
                    {l.farmName}
                  </Text>
                  <Text style={[styles.muted, { marginTop: 2 }]}>
                    {formatLfoDate(l.orderDate)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <SharePdfIconButton
                    onPress={() => {
                      void shareSavedLfo(l.id).catch((e) => {
                        onShareError?.(
                          userFacingMessage(e, "Could not share PDF. Try again in a moment."),
                        );
                      });
                    }}
                    accessibilityLabel={`Share PDF for ${l.farmName}`}
                  />
                  {l.houseSummary.length > 0 ? (
                    <CopyHouseSummaryButton lines={l.houseSummary} farmName={l.farmName} />
                  ) : null}
                </View>
              </View>
              {l.houseSummary.length > 0 ? (
                <View style={{ marginTop: 8, gap: 2, flexShrink: 0 }}>
                  {l.houseSummary.map((line) => (
                    <Text
                      key={line}
                      style={{ fontWeight: "700", color: colors.text, fontSize: 13 }}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Pressable>
          </Card>
        </Swipeable>
      ))}
    </>
  );
}

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function LfoListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string | string[] }>();
  const routeFarmId = paramId(params.farmId);
  const [lfos, setLfos] = useState<ReturnType<typeof listLfos>>([]);
  const [farms, setFarms] = useState<ReturnType<typeof listFarms>["farms"]>([]);
  const [farmId, setFarmId] = useState(() =>
    lfoTabFromRoute(routeFarmId || undefined, MANUAL_LFO_TAB_ID),
  );
  const appliedRouteFarmId = useRef(routeFarmId);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; farmName: string } | null>(
    null,
  );

  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("lfo", scrollRef);

  const load = useCallback(() => {
    const nextFarms = listFarms().farms;
    setFarms(nextFarms);
    setLfos(listLfos());
    setFarmId((prev) => {
      if (prev === MANUAL_LFO_TAB_ID) return prev;
      if (prev && nextFarms.some((f) => f.id === prev)) return prev;
      return MANUAL_LFO_TAB_ID;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (routeFarmId === appliedRouteFarmId.current) return;
    appliedRouteFarmId.current = routeFarmId;
    setFarmId(lfoTabFromRoute(routeFarmId || undefined, MANUAL_LFO_TAB_ID));
  }, [routeFarmId]);

  function openLfo(id: string) {
    router.push(`/(tabs)/lfo/${id}`);
  }

  const isManual = farmId === MANUAL_LFO_TAB_ID;

  function selectFarm(id: string) {
    setFarmId(id);
  }

  function confirmDelete(id: string, farmName: string) {
    setDeleteTarget({ id, farmName });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {msg ? (
        <Text
          style={{
            color: msg === "Created LFO" || msg === "LFO deleted" ? colors.accentDark : colors.danger,
            fontWeight: "700",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          {msg}
        </Text>
      ) : null}
      {isManual ? (
        <ManualLfoScreen
          farms={farms}
          farmId={farmId}
          onSelectFarm={selectFarm}
          onSaved={(id) => {
            setLfos(listLfos());
            openLfo(id);
          }}
          savedSection={
            <SavedLfoList
              lfos={lfos}
              onOpen={openLfo}
              onDelete={confirmDelete}
              onShareError={setMsg}
            />
          }
        />
      ) : (
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          keyboardShouldPersistTaps="handled"
        >
          <PageHeader
            title="Last Feed Order"
          />

          <LfoFarmTabs farms={farms} selectedId={farmId} onSelect={selectFarm} />
          <PrimaryButton
            label="Create LFO"
            onPress={() => {
              if (!farmId || farmId === MANUAL_LFO_TAB_ID) {
                setMsg("Select a farm first");
                return;
              }
              setLoading(true);
              try {
                const { id } = createLfo(farmId, todayKey(), undefined, currentHalfHourTime());
                setLfos(listLfos());
                setMsg("Created LFO");
                openLfo(id);
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Could not create LFO");
              } finally {
                setLoading(false);
              }
            }}
          />

          <SavedLfoList
            lfos={lfos}
            onOpen={openLfo}
            onDelete={confirmDelete}
            onShareError={setMsg}
          />
        </ScrollView>
      </View>
      )}
      <ConfirmDialog
        visible={deleteTarget != null}
        title="Are you sure?"
        message={
          deleteTarget
            ? `Delete LFO for ${deleteTarget.farmName}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteLfo(deleteTarget.id);
          setLfos(listLfos());
          setMsg("LFO deleted");
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}
