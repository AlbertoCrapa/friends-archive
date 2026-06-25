'use server';

// ============================================
// Join request server actions
// ============================================
//
// All four mutations go through SECURITY DEFINER functions in Postgres
// (see docs/SUPABASE_SETUP.md, Step 4f). There are no INSERT/UPDATE/DELETE
// RLS policies on group_join_requests — the RPCs are the only write path,
// so ownership and plan-limit checks live in exactly one place.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function revalidateGroupViews(groupId: string) {
  revalidatePath('/discover');
  revalidatePath('/dashboard');
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
}

/** Create (or re-open a declined) access request for the current user. */
export async function requestGroupAccess(groupId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('request_group_access', { p_group_id: groupId });
  revalidateGroupViews(groupId);
}

/** Withdraw the current user's pending request. */
export async function cancelGroupAccessRequest(groupId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('cancel_join_request', { p_group_id: groupId });
  revalidateGroupViews(groupId);
}

/** Owner approves a pending request — the requester becomes a member. */
export async function approveJoinRequest(requestId: string, groupId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_join_request', { p_request_id: requestId });
  revalidateGroupViews(groupId);
  if (error?.message.includes('plan_limit_reached')) {
    return { error: 'This user has reached the group limit of their plan.' };
  }
  return { error: error ? 'Could not approve the request. Please try again.' : null };
}

/** Owner declines a pending request. */
export async function declineJoinRequest(requestId: string, groupId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('decline_join_request', { p_request_id: requestId });
  revalidateGroupViews(groupId);
  return { error: error ? 'Could not decline the request. Please try again.' : null };
}
