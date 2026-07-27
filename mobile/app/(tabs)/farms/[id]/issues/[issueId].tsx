import { useLocalSearchParams } from "expo-router";
import { IssueFormScreen } from "../../../../../src/components/IssueFormScreen";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function EditIssueScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    issueId?: string | string[];
  }>();
  return <IssueFormScreen farmId={paramId(params.id)} issueId={paramId(params.issueId)} />;
}
