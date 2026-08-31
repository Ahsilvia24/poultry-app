import Link from "next/link";
import { createFarmAction } from "@/app/actions/farms";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";

async function submitCreateFarm(formData: FormData) {
  "use server";
  await createFarmAction(formData);
}

export default function NewFarmPage() {
  return (
    <div>
      <PageHeader
        title="New Farm"
        actions={
          <Link href="/farms">
            <Button variant="secondary">Cancel</Button>
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <form action={submitCreateFarm} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="farmName">Farm name *</Label>
              <Input id="farmName" name="farmName" required />
            </div>
            <div>
              <Label htmlFor="numberOfHouses">Number of houses</Label>
              <Input
                id="numberOfHouses"
                name="numberOfHouses"
                type="number"
                min={0}
                max={40}
                inputMode="numeric"
                defaultValue={4}
              />
              <p className="mt-1 text-xs text-stone-500">
                Creates houses 1–N with default 29,700 sq ft (editable later)
              </p>
            </div>
            <div>
              <Label htmlFor="numberOfGenerators">Number of generators</Label>
              <Select id="numberOfGenerators" name="numberOfGenerators" defaultValue="">
                <option value="">Not set</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-stone-500">Optional — you can set this later</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="growerName">Grower name</Label>
              <Input id="growerName" name="growerName" />
            </div>
          </div>
          <Button type="submit" className="w-full sm:w-auto">
            Create farm
          </Button>
        </form>
      </Card>
    </div>
  );
}
