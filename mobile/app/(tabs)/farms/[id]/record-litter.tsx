import { useLocalSearchParams } from "expo-router";
import { LitterFormScreen } from "../../../../src/components/LitterFormScreen";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function RecordLitterScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  return <LitterFormScreen farmId={paramId(params.id)} />;
}
