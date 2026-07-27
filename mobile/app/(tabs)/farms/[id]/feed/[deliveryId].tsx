import { useLocalSearchParams } from "expo-router";
import { FeedFormScreen } from "../../../../../src/components/FeedFormScreen";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function EditFeedScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    deliveryId?: string | string[];
  }>();
  return (
    <FeedFormScreen farmId={paramId(params.id)} deliveryId={paramId(params.deliveryId)} />
  );
}
