import { Input, Label } from "@/components/ui";

const dateInputClass =
  "min-h-11 px-2 text-base [color-scheme:light] [&::-webkit-date-and-time-value]:text-left";

export function ReportDateRangeFields({
  fromLabel,
  toLabel,
  from,
  to,
}: {
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0">
        <Label htmlFor="from">{fromLabel}</Label>
        <Input
          id="from"
          name="from"
          type="date"
          compact
          defaultValue={from}
          className={dateInputClass}
        />
      </div>
      <div className="min-w-0">
        <Label htmlFor="to">{toLabel}</Label>
        <Input
          id="to"
          name="to"
          type="date"
          compact
          defaultValue={to}
          className={dateInputClass}
        />
      </div>
    </div>
  );
}
