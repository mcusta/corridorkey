import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { JobStatus } from "@/lib/types";

const ACTIVE_STATUSES: JobStatus[] = ["queued", "preparing", "processing", "uploading"];

export default function StatusBadge({ status }: { status: JobStatus }) {
  const isActive = ACTIVE_STATUSES.includes(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {isActive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}
