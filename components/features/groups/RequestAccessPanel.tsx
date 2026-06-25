import { requestGroupAccess, cancelGroupAccessRequest } from '@/app/actions/join-requests';
import { RequestAccessSubmitButton } from './RequestAccessSubmitButton';
import { Clock } from 'lucide-react';
import type { JoinRequestStatus } from '@/types';

interface Props {
  groupId: string;
  /** Current user's request for this group; null when none exists */
  requestStatus: JoinRequestStatus | null;
}

/**
 * Request-access controls for a non-member. Renders the right state of the
 * request lifecycle: not requested → pending (cancellable) → declined (retry).
 */
export function RequestAccessPanel({ groupId, requestStatus }: Props) {
  if (requestStatus === 'pending') {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-stone-500">
          <Clock className="h-3 w-3" />
          Access requested — waiting for the owner
        </span>
        <form action={cancelGroupAccessRequest.bind(null, groupId)}>
          <RequestAccessSubmitButton label="Cancel request" pendingLabel="Cancelling..." variant="ghost" />
        </form>
      </div>
    );
  }

  if (requestStatus === 'declined') {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'oklch(0.6 0.18 15)' }}>
          Your request was declined
        </span>
        <form action={requestGroupAccess.bind(null, groupId)}>
          <RequestAccessSubmitButton label="Request again" />
        </form>
      </div>
    );
  }

  return (
    <form action={requestGroupAccess.bind(null, groupId)}>
      <RequestAccessSubmitButton />
    </form>
  );
}
