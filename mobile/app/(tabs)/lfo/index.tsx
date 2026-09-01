import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { deleteLfo, getLfo, listFarms, listLfos } from "../../../src/repos/data";
import { shareLfoPdf } from "../../../src/lib/reports/shareLfoPdf";
import { SharePdfIconButton } from "../../../src/components/SharePdfIconButton";
import { useExclusiveSwipeables } from "../../../src/lib/useExclusiveSwipeables";
import { LFO_SWIPE_DELETE_COMMIT_PX } from "../../../src/lib/swipe-commit";
import { colors, styles } from "../../../src/theme";
import { Card } from "../../../src/components/ui";
import { CopyHouseSummaryButton } from "../../../src/components/LfoHouseSummaryBlock";
import { MANUAL_LFO_TAB_ID } from "../../../src/components/LfoFarmTabs";
import { ManualLfoScreen } from "../../../src/components/ManualLfoScreen";
import { FarmLfoScreen } from "../../../src/components/FarmLfoScreen";
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
  onDelete: (id: string) => void;
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
          <Text style={styles.muted}>None yet — save from Quick Calc or a farm tab.</Text>
        </Card>
      ) : null}
      {lfos.map((l) => (
        <Swipeable
          key={l.id}
          ref={swipe.setRef(l.id)}
          overshootRight={false}
          friction={2}
          rightThreshold={LFO_SWIPE_DELETE_COMMIT_PX}
          containerStyle={{ marginBottom: 12 }}
          onSwipeableWillOpen={() => swipe.closeOthers(l.id)}
          onSwipeableOpen={(direction) => {
            if (direction === "right") onDelete(l.id);
          }}
          renderRightActions={() => (
            <View
              accessibilityLabel={`Delete LFO for ${l.farmName}`}
              style={{
                backgroundColor: colors.danger,
                justifyContent: "center",
                alignItems: "center",
                width: LFO_SWIPE_DELETE_COMMIT_PX,
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
            </View>
          )}
        >
          <Card style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Pressable
                  onPress={() => onOpen(l.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit LFO for ${l.farmName}`}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontWeight: "800" }} numberOfLines={1}>
                    {l.farmName}
                  </Text>
                  <Text style={[styles.muted, { marginTop: 2 }]}>
                    {formatLfoDate(l.orderDate)}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {l.houseSummary.length > 0 ? (
                    <CopyHouseSummaryButton lines={l.houseSummary} farmName={l.farmName} />
                  ) : null}
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
                </View>
              </View>
              {l.houseSummary.length > 0 ? (
                <Pressable
                  onPress={() => onOpen(l.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit LFO for ${l.farmName}`}
                  style={{ marginTop: 8, gap: 2, flexShrink: 0 }}
                >
                  {l.houseSummary.map((line) => (
                    <Text
                      key={line}
                      style={{ fontWeight: "700", color: colors.text, fontSize: 13 }}
                    >
                      {line}
                    </Text>
                  ))}
                </Pressable>
              ) : null}
            </View>
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
  const [msg, setMsg] = useState<string | null>(null);

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

  function removeLfo(id: string) {
    deleteLfo(id);
    setLfos(listLfos());
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {msg ? (
        <Text
          style={{
            color: msg === "LFO deleted" ? colors.accentDark : colors.danger,
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
          onSaved={() => {
            setLfos(listLfos());
          }}
          savedSection={
            <SavedLfoList
              lfos={lfos}
              onOpen={openLfo}
              onDelete={removeLfo}
              onShareError={setMsg}
            />
          }
        />
      ) : (
        <FarmLfoScreen
          key={farmId}
          farms={farms}
          farmId={farmId}
          onSelectFarm={selectFarm}
          onSaved={() => {
            setLfos(listLfos());
          }}
          savedSection={
            <SavedLfoList
              lfos={lfos}
              onOpen={openLfo}
              onDelete={removeLfo}
              onShareError={setMsg}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
