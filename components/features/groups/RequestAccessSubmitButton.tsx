'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  /** Label for the idle state, e.g. "Request to join" or "Request again" */
  label?: string;
  /** Label shown while the action is in flight */
  pendingLabel?: string;
  variant?: 'outline' | 'ghost' | 'default';
}

export function RequestAccessSubmitButton({
  label = 'Request to join',
  pendingLabel = 'Requesting...',
  variant = 'outline',
}: Props) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="h-3 w-3" />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}
