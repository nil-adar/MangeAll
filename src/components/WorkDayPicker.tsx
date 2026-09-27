import { Building2, House, Palmtree, Thermometer, UserX } from "lucide-react";
import { WORK_STATUS_LABEL, WORK_STATUS_ORDER, type WorkStatus } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * One place for how each work status looks, shared by the home-page daily
 * question and the /workday monthly log so a status reads the same in both.
 */
const STYLE: Record<WorkStatus, { icon: typeof Building2; soft: string; solid: string }> = {
  office: { icon: Building2, soft: "bg-primary/10 text-primary", solid: "bg-primary text-primary-foreground" },
  home: { icon: House, soft: "bg-emerald-500/10 text-emerald-600", solid: "bg-emerald-500 text-white" },
  off: { icon: Palmtree, soft: "bg-sky-500/10 text-sky-600", solid: "bg-sky-500 text-white" },
  sick: { icon: Thermometer, soft: "bg-amber-500/10 text-amber-600", solid: "bg-amber-500 text-white" },
  absent: { icon: UserX, soft: "bg-red-500/10 text-red-500", solid: "bg-red-500 text-white" },
};

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Row of 5 tap targets — one per work status. */
export function WorkStatusButtons({
  value,
  onSelect,
  disabled,
}: {
  value?: WorkStatus | null | undefined;
  onSelect: (status: WorkStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {WORK_STATUS_ORDER.map((status) => {
        const { icon: Icon, soft, solid } = STYLE[status];
        const selected = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(status)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-[11px] font-bold transition-[transform,background-color,color] duration-150 active:scale-[0.95] disabled:opacity-50",
              selected ? solid : cn(soft, "hover-fine:hover:brightness-95")
            )}
            style={{ transitionTimingFunction: ease }}
          >
            <Icon className="size-5" />
            {WORK_STATUS_LABEL[status]}
          </button>
        );
      })}
    </div>
  );
}

/** Compact read-only badge for an already-set day. */
export function WorkStatusChip({ status }: { status: WorkStatus }) {
  const { icon: Icon, soft } = STYLE[status];
  return (
    <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", soft)}>
      <Icon className="size-3.5 shrink-0" />
      {WORK_STATUS_LABEL[status]}
    </span>
  );
}
