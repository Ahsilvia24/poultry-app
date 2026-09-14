import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../../../../../src/theme";
import { BackHeader, Card } from "../../../../../src/components/ui";
import { SwipeCommitDeleteRow } from "../../../../../src/components/SwipeCommitDeleteRow";
import { deleteIssue, listFarmIssues } from "../../../../../src/repos/data";
import { formatServiceShortDate } from "../../../../../src/lib/serviceForms/format";
import { ISSUE_CATEGORY_LABELS } from "../../../../../src/lib/opsLabels";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type IssueRow = {
  id: string;
  dateReported: string;
  category: string;
};

export default function FarmIssuesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!farmId) {
      setIssues([]);
      return;
    }
    try {
      setIssues(listFarmIssues(farmId));
      setError(null);
    } catch (e) {
      setIssues([]);
      setError(e instanceof Error ? e.message : "Could not load issues");
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openIssue(issueId: string) {
    router.push({
      pathname: "/(tabs)/farms/[id]/issues/[issueId]",
      params: { id: farmId, issueId },
    });
  }

  function removeIssue(issueId: string) {
    try {
      deleteIssue(farmId, issueId);
      setIssues((prev) => prev.filter((row) => row.id !== issueId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete issue");
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <BackHeader
          backLabel="Farm"
          title="Issues"
          accessibilityLabel="Back to farm"
          onBack={() =>
            router.replace({
              pathname: "/(tabs)/farms/[id]",
              params: { id: farmId },
            })
          }
        />

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(tabs)/farms/[id]/report-issue",
              params: { id: farmId },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Log issue"
          style={{
            minHeight: 44,
            marginBottom: 16,
            borderRadius: 10,
            backgroundColor: colors.accentDark,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Log Issue</Text>
        </Pressable>

        {error ? (
          <Text style={{ color: colors.danger, fontWeight: "600", marginBottom: 8 }}>{error}</Text>
        ) : null}

        {issues.length === 0 ? (
          <Text style={{ color: colors.muted }}>No issues yet.</Text>
        ) : (
          issues.map((issue) => {
            const title = ISSUE_CATEGORY_LABELS[issue.category] ?? issue.category;
            const dateLabel = formatServiceShortDate(issue.dateReported);
            return (
              <SwipeCommitDeleteRow
                key={issue.id}
                onDelete={() => removeIssue(issue.id)}
                style={{ marginBottom: 10 }}
                deleteContent={
                  <View
                    accessibilityLabel={`Delete ${title} ${dateLabel}`}
                    style={{ alignItems: "center" }}
                  >
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, marginTop: 4 }}>
                      Delete
                    </Text>
                  </View>
                }
              >
                <Card style={{ marginBottom: 0, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Pressable
                    onPress={() => openIssue(issue.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`View or edit ${title} ${dateLabel}`}
                  >
                    <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>
                      {title}
                    </Text>
                    <Text style={{ marginTop: 2, color: colors.muted, fontWeight: "600" }}>
                      {dateLabel}
                    </Text>
                  </Pressable>
                </Card>
              </SwipeCommitDeleteRow>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
