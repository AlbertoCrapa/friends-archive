import type { Metadata } from 'next';
import { BallotSheet } from '@/components/features/ballot/BallotSheet';
import '@/components/micro/micro.css';
import './ballot.css';

export const metadata: Metadata = {
  title: 'Ballot sheet | The Friend Archive',
  description: 'The group queue, marked by hand: rate, triage and sort what six people are deciding to watch next.',
};

export default function BallotPage() {
  return <BallotSheet />;
}
