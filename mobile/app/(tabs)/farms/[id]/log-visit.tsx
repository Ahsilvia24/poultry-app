import { useLocalSearchParams } from "expo-router";
import { VisitFormScreen } from "../../../../src/components/VisitFormScreen";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function LogVisitScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  return <VisitFormScreen farmId={paramId(params.id)} />;
}
