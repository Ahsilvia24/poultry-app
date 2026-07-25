import Link from "next/link";
import { createFarmAction } from "@/app/actions/farms";
import { Button, Card, Input, Label, PageHeader, Textarea } from "@/components/ui";

async function submitCreateFarm(formData: FormData) {
  "use server";
  await createFarmAction(formData);
}

export default function NewFarmPage() {
  return (
    <div>
      <PageHeader
        title="New farm"
        subtitle="Add a grower farm to your route"
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
              <Label htmlFor="farmName">Farm name</Label>
              <Input id="farmName" name="farmName" required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="growerName">Grower name</Label>
              <Input id="growerName" name="growerName" required />
            </div>
            <div>
              <Label htmlFor="farmNumber">Farm number</Label>
              <Input id="farmNumber" name="farmNumber" />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone</Label>
              <Input id="phoneNumber" name="phoneNumber" type="tel" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" />
            </div>
            <div>
              <Label htmlFor="zipCode">ZIP</Label>
              <Input id="zipCode" name="zipCode" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
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
