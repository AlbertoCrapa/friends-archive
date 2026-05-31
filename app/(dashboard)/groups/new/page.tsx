import { CreateGroupForm } from '@/components/features/groups/CreateGroupForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NewGroupPage() {
  return (
    <div className="max-w-lg space-y-8">
      <div>
        <Link href="/dashboard" className="inline-flex mb-4">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
        <h1 className="font-serif text-3xl text-stone-100">Create a group</h1>
        <p className="text-stone-500 text-sm font-mono mt-1">
          Invite friends, add media, and track together.
        </p>
      </div>
      <CreateGroupForm />
    </div>
  );
}
