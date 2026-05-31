import { CreateGroupForm } from '@/components/features/groups/CreateGroupForm';

export default function NewGroupPage() {
  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-stone-100">Create a group</h1>
        <p className="text-stone-500 text-sm font-mono mt-1">
          Invite friends, add media, and track together.
        </p>
      </div>
      <CreateGroupForm />
    </div>
  );
}
