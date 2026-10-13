import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createGeneratorLog, updateGeneratorLog } from "../repos/data";
import {
  detectGeneratorHourSwap,
  formatGeneratorHours,
  hoursDelta,
  previousGeneratorHoursFromLogs,
  GENERATOR_FIELD_DEFS,
  type GenHourKey,
  type GeneratorHourSwapSuggestion,
} from "../lib/generator";
import { todayKey } from "../lib/ids";
import { colors } from "../theme";
import { PrimaryButton } from "./ui";
import { SettingsChipInput, SettingsRow } from "./SettingsLayout";
import { DatePickerField } from "./DatePickerField";
import { ConfirmDialog } from "./ConfirmDialog";

export type GeneratorLogDraftRow = {
  id: string;
  logDate: string;
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
};

type HourDraft = {
  logDate: string;
  gen1Hours: string;
  gen2Hours: string;
  gen3Hours: string;
  gen4Hours: string;
};

function emptyDraft(): HourDraft {
  return {
    logDate: todayKey(),
    gen1Hours: "",
    gen2Hours: "",
    gen3Hours: "",
    gen4Hours: "",
  };
}

function draftFromLog(log: GeneratorLogDraftRow): HourDraft {
  return {
    logDate: log.logDate,
    gen1Hours: log.gen1Hours == null ? "" : String(log.gen1Hours),
    gen2Hours: log.gen2Hours == null ? "" : String(log.gen2Hours),
    gen3Hours: log.gen3Hours == null ? "" : String(log.gen3Hours),
    gen4Hours: log.gen4Hours == null ? "" : String(log.gen4Hours),
  };
}

export function GeneratorLogModal({
  visible,
  farmId,
  logs,
  editing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  farmId: string;
  logs: GeneratorLogDraftRow[];
  editing: { log: GeneratorLogDraftRow; onlyGen: GenHourKey | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<HourDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swap, setSwap] = useState<GeneratorHourSwapSuggestion | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const editingId = editing?.log.id ?? null;
  const editingGen = editing?.onlyGen ?? null;
  useEffect(() => {
    if (!visible) return;
    setSaving(false);
    setError(null);
    setSwap(null);
    setDraft(editing ? draftFromLog(editing.log) : emptyDraft());
    // Reseed only when a different row opens. Parent re-renders must not wipe digits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingId, editingGen]);

  function close() {
    if (saving) return;
    onClose();
  }

  function parseDraftHours(source: HourDraft = draft) {
    const parseHours = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("Generator hours must be 0 or greater");
      }
      return n;
    };
    return {
      logDate: source.logDate.trim(),
      gen1Hours: parseHours(source.gen1Hours),
      gen2Hours: parseHours(source.gen2Hours),
      gen3Hours: parseHours(source.gen3Hours),
      gen4Hours: parseHours(source.gen4Hours),
    };
  }

  function persist(
    hours: {
      logDate: string;
      gen1Hours: number | null;
      gen2Hours: number | null;
      gen3Hours: number | null;
      gen4Hours: number | null;
    },
    remapAll = false,
  ) {
    if (editing) {
      updateGeneratorLog(farmId, editing.log.id, {
        ...hours,
        onlyGen: remapAll ? undefined : editing.onlyGen ?? undefined,
      });
    } else {
      createGeneratorLog({ farmId, ...hours });
    }
    onSaved();
    onClose();
  }

  function save(
    hours?: {
      logDate: string;
      gen1Hours: number | null;
      gen2Hours: number | null;
      gen3Hours: number | null;
      gen4Hours: number | null;
    },
    remapAll = false,
  ) {
    setSaving(true);
    setError(null);
    try {
      const payload = hours ?? parseDraftHours();
      if (!hours) {
        const previous = previousGeneratorHoursFromLogs(logs, {
          onOrBeforeDate: payload.logDate,
          excludeLogId: editing?.log.id,
        });
        const onlyGen = editing?.onlyGen;
        const entered = onlyGen
          ? {
              gen1Hours: onlyGen === "gen1Hours" ? payload.gen1Hours : null,
              gen2Hours: onlyGen === "gen2Hours" ? payload.gen2Hours : null,
              gen3Hours: onlyGen === "gen3Hours" ? payload.gen3Hours : null,
              gen4Hours: onlyGen === "gen4Hours" ? payload.gen4Hours : null,
            }
          : payload;
        const found = detectGeneratorHourSwap(previous, entered);
        if (found) {
          setSwap(found);
          return;
        }
      }
      persist(payload, remapAll);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save generator log");
    } finally {
      setSaving(false);
    }
  }

  const fields = editing?.onlyGen
    ? GENERATOR_FIELD_DEFS.filter((field) => field.hourKey === editing.onlyGen)
    : GENERATOR_FIELD_DEFS;
  const title = editing
    ? editing.onlyGen
      ? `Edit ${GENERATOR_FIELD_DEFS.find((field) => field.hourKey === editing.onlyGen)?.label ?? "generator"}`
      : "Edit generators"
    : "Log generators";

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={close} />
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: "92%",
                overflow: "hidden",
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: 20,
                  paddingBottom: Platform.OS === "ios" ? 28 : 24,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{title}</Text>
                {error ? (
                  <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                    {error}
                  </Text>
                ) : null}
                <View style={{ marginTop: 14, marginBottom: 4 }}>
                  <DatePickerField
                    label="Date logged"
                    layout="settings"
                    value={draft.logDate}
                    presentation="inline"
                    onChange={(date) => setDraft((prev) => ({ ...prev, logDate: date }))}
                  />
                </View>
                {fields.map((field, index, list) => {
                  const previous = previousGeneratorHoursFromLogs(logs, {
                    onOrBeforeDate: draft.logDate,
                    excludeLogId: editing?.log.id,
                  });
                  const raw = draft[field.hourKey];
                  const delta = hoursDelta(
                    raw.trim() === "" ? null : Number(raw),
                    previous[field.hourKey] ?? null,
                  );
                  const isLast = index === list.length - 1;
                  return (
                    <View key={field.hourKey}>
                      <SettingsRow label={`${field.label} hours`}>
                        <SettingsChipInput
                          inputRef={(el) => {
                            inputRefs.current[index] = el;
                          }}
                          value={raw}
                          keyboardType="decimal-pad"
                          accessibilityLabel={`${field.label} hours`}
                          returnKeyType={isLast ? "done" : "next"}
                          blurOnSubmit={isLast}
                          onSubmitEditing={() => {
                            if (isLast) Keyboard.dismiss();
                            else inputRefs.current[index + 1]?.focus();
                          }}
                          onChangeText={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              [field.hourKey]: value.replace(/[^\d.]/g, ""),
                            }))
                          }
                        />
                      </SettingsRow>
                      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>
                        Time exercised: {formatGeneratorHours(delta)}
                      </Text>
                    </View>
                  );
                })}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <PrimaryButton
                    label={saving ? "Saving…" : "Save"}
                    onPress={() => save()}
                    style={{ flex: 1 }}
                  />
                  <PrimaryButton
                    label="Cancel"
                    secondary
                    onPress={close}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <ConfirmDialog
        visible={swap != null}
        title="Hours look swapped"
        message={swap?.message ?? ""}
        confirmLabel="Fix and save"
        altLabel="Save as entered"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!swap) return;
          const parsed = parseDraftHours();
          save({ ...parsed, ...swap.suggested }, true);
        }}
        onAlt={() => {
          save(parseDraftHours(), false);
        }}
        onCancel={() => setSwap(null)}
      />
    </>
  );
}
