import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createIssue,
  deleteIssue,
  getFarmDetail,
  getIssue,
  updateIssue,
} from "../repos/data";
import { todayKey } from "../lib/ids";
import {
  ISSUE_CATEGORY_LABELS,
  ISSUE_CATEGORY_OPTIONS,
  ISSUE_PRIORITY_OPTIONS,
  ISSUE_STATUS_OPTIONS,
} from "../lib/opsLabels";
import { colors, styles } from "../theme";
import { Card, PageHeader, PrimaryButton } from "./ui";
import { OptionPicker, SelectField } from "./OptionPicker";

export function IssueFormScreen({ farmId, issueId }: { farmId: string; issueId?: string }) {
  const router = useRouter();
  const editing = Boolean(issueId);
  const detail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);
  const initial = useMemo(() => {
    if (!issueId) return null;
    try {
      return getIssue(farmId, issueId);
    } catch {
      return null;
    }
  }, [farmId, issueId]);

  const houses = detail?.houses ?? [];
  const [dateReported, setDateReported] = useState(initial?.dateReported ?? todayKey());
  const [houseId, setHouseId] = useState(initial?.houseId ?? "");
  const [category, setCategory] = useState(initial?.category ?? "OTHER");
  const [priority, setPriority] = useState(initial?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(initial?.status ?? "OPEN");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(initial?.correctiveAction ?? "");
  const [picker, setPicker] = useState<"house" | "category" | "priority" | "status" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (editing && !initial) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Text style={{ color: colors.danger }}>Issue not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        farmId,
        flockId: detail?.activeFlock?.id,
        houseId: houseId || null,
        dateReported: dateReported.trim(),
        category,
        priority,
        status,
        assignedTo,
        description,
        correctiveAction,
      };
      if (issueId) updateIssue(issueId, payload);
      else createIssue(payload);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save issue");
      setBusy(false);
    }
  }

  const houseLabel =
    houseId === ""
      ? "Entire farm"
      : `House ${houses.find((h) => h.id === houseId)?.houseNumber ?? "?"}`;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
          </Pressable>
          <PageHeader
            title={editing ? "Edit issue" : "Report issue"}
            subtitle={detail?.farm.farmName ?? "Farm"}
          />
          <Card>
            <Text style={styles.label}>Date reported (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={dateReported} onChangeText={setDateReported} />
            <SelectField label="House" valueLabel={houseLabel} onPress={() => setPicker("house")} />
            <SelectField
              label="Category"
              valueLabel={ISSUE_CATEGORY_LABELS[category] ?? category}
              onPress={() => setPicker("category")}
            />
            <SelectField
              label="Priority"
              valueLabel={ISSUE_PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority}
              onPress={() => setPicker("priority")}
            />
            <SelectField
              label="Status"
              valueLabel={ISSUE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
              onPress={() => setPicker("status")}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Assigned to</Text>
            <TextInput style={styles.input} value={assignedTo} onChangeText={setAssignedTo} />
            <Text style={[styles.label, { marginTop: 8 }]}>Description *</Text>
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Corrective action</Text>
            <TextInput
              style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]}
              value={correctiveAction}
              onChangeText={setCorrectiveAction}
              multiline
            />
            {error ? (
              <Text style={{ color: colors.danger, marginBottom: 12, fontWeight: "600" }}>
                {error}
              </Text>
            ) : null}
            {busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <PrimaryButton label={editing ? "Save changes" : "Save issue"} onPress={save} />
            )}
            {editing && issueId ? (
              <PrimaryButton
                label="Delete issue"
                secondary
                style={{ marginTop: 10 }}
                onPress={() =>
                  Alert.alert("Delete issue?", "This cannot be undone.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        deleteIssue(farmId, issueId);
                        router.back();
                      },
                    },
                  ])
                }
              />
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionPicker
        open={picker === "house"}
        title="House"
        value={houseId}
        options={[
          { value: "", label: "Entire farm" },
          ...houses.map((h) => ({ value: h.id, label: `House ${h.houseNumber}` })),
        ]}
        onSelect={setHouseId}
        onClose={() => setPicker(null)}
      />
      <OptionPicker
        open={picker === "category"}
        title="Category"
        value={category}
        options={ISSUE_CATEGORY_OPTIONS}
        onSelect={setCategory}
        onClose={() => setPicker(null)}
      />
      <OptionPicker
        open={picker === "priority"}
        title="Priority"
        value={priority}
        options={[...ISSUE_PRIORITY_OPTIONS]}
        onSelect={setPriority}
        onClose={() => setPicker(null)}
      />
      <OptionPicker
        open={picker === "status"}
        title="Status"
        value={status}
        options={[...ISSUE_STATUS_OPTIONS]}
        onSelect={setStatus}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}
