import { useLocalSearchParams } from "expo-router";
import { VisitFormScreen } from "../../../../../src/components/VisitFormScreen";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function EditVisitScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    visitId?: string | string[];
  }>();
  return (
    <VisitFormScreen farmId={paramId(params.id)} visitId={paramId(params.visitId)} />
  );
}
