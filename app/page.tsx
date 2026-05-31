import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let nickname: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .single();
    nickname = profile?.nickname ?? null;
  }

  return (
    <main className="min-h-screen flex flex-col bg-stone-950">
      {/* Navigation */}
      <header className="border-b border-stone-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-serif text-xl tracking-widest text-stone-100 uppercase">
            The Friend Archive
          </span>
          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                {nickname && (
                  <Link href={`/profile/${nickname}`}>
                    <Button size="sm">My profile</Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32">
        <p className="font-mono uppercase tracking-[0.3em] text-amber-500/70 text-xs mb-8">
          Track together. Remember always.
        </p>
        <h1 className="font-serif text-6xl md:text-8xl font-light text-stone-100 leading-tight mb-6">
          The Friend<br />
          <span className="text-amber-500">Archive</span>
        </h1>
        <p className="text-stone-400 text-lg max-w-xl mx-auto mb-12 font-light leading-relaxed">
          A shared catalogue for everything worth experiencing together.
          Movies, TV series, books, and games — organised, remembered, and
          enjoyed with the people who matter.
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {user ? (
            <>
              <Link href="/dashboard">
                <Button size="lg">Open dashboard</Button>
              </Link>
              <Link href="/discover">
                <Button variant="outline" size="lg">Discover groups</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/register">
                <Button size="lg">Create your archive</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg">Sign in</Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-stone-800/50 py-24">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            {
              icon: '◫',
              title: 'Shared catalogues',
              body: 'Create groups with friends and family. Each group holds a curated list of things to watch, read, and play.',
            },
            {
              icon: '◎',
              title: 'Track your progress',
              body: 'Mark items as planned, in progress, or completed. Keep personal notes on what you thought — visible only to you.',
            },
            {
              icon: '◈',
              title: 'Discover new groups',
              body: 'Browse public archives from other users. Get inspired by what others are tracking together.',
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="space-y-4">
              <span className="font-mono text-2xl text-amber-500/60">{icon}</span>
              <h3 className="font-serif text-xl text-stone-100">{title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed font-light">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Media types strip */}
      <section className="border-t border-stone-800/50 py-12">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center gap-8 flex-wrap">
          {['Movies', 'TV Series', 'Books', 'Video Games'].map((type) => (
            <span key={type} className="font-mono uppercase tracking-widest text-xs text-stone-600">
              {type}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-800/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-stone-600 text-xs font-mono">
          <span className="uppercase tracking-widest">The Friend Archive</span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-stone-400 transition-colors uppercase tracking-wider">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
