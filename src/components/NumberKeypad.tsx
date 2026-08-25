"use client";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function Key({
  label,
  onPress,
  variant = "default",
}: {
  label: string;
  onPress: () => void;
  variant?: "default" | "muted" | "enter";
}) {
  const variants = {
    default: "bg-white text-stone-900 active:bg-stone-100",
    muted: "bg-[#d6d3d1] text-stone-900 active:bg-stone-300",
    enter: "bg-emerald-700 text-white active:bg-emerald-800",
  };
  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex min-h-12 flex-1 items-center justify-center rounded-[10px] text-[22px] font-bold ${variants[variant]}`}
    >
      {label}
    </button>
  );
}

export function NumberKeypad({
  onDigit,
  onBackspace,
  onEnter,
  allowDecimal = false,
  allowTripleZero = false,
  extraAction,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  allowDecimal?: boolean;
  allowTripleZero?: boolean;
  extraAction?: { label: string; onPress: () => void };
}) {
  return (
    <div className="border-t border-stone-200 bg-[#e7e5e4] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {extraAction ? (
        <button
          type="button"
          onClick={extraAction.onPress}
          className="mb-2 flex min-h-12 w-full items-center justify-center rounded-[10px] bg-emerald-700 px-3 text-base font-extrabold text-white active:bg-emerald-800"
        >
          {extraAction.label}
        </button>
      ) : null}
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-2">
            {keys.slice(row * 3, row * 3 + 3).map((d) => (
              <Key key={d} label={d} onPress={() => onDigit(d)} />
            ))}
          </div>
        ))}
        <div className="flex gap-2">
          <Key label="⌫" onPress={onBackspace} variant="muted" />
          <Key label="0" onPress={() => onDigit("0")} />
          {allowDecimal ? (
            <Key label="." onPress={() => onDigit(".")} />
          ) : allowTripleZero ? (
            <Key label="000" onPress={() => onDigit("000")} />
          ) : null}
          <Key label="Enter" onPress={onEnter} variant="enter" />
        </div>
      </div>
    </div>
  );
}

export function appendKeypadDigit(current: string, digit: string, allowDecimal: boolean) {
  if (digit === ".") {
    if (!allowDecimal || current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (digit === "000") {
    if (current === "" || current === "0") return "000";
    return `${current}000`;
  }
  if (current === "0") return digit;
  return `${current}${digit}`;
}

export function backspaceKeypadValue(current: string) {
  return current.slice(0, -1);
}
