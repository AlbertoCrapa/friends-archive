'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function JoinGroupSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="h-3 w-3" />
          Joining...
        </span>
      ) : (
        'Join'
      )}
    </Button>
  );
}
