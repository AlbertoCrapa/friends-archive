import { Header } from '@/components/layout/Header';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-stone-950">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
