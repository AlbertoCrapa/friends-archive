export default function UpgradePage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
      <span className="font-mono text-4xl text-amber-500/30">◈</span>
      <h1 className="font-serif text-3xl text-stone-100">Upgrade</h1>
      <p className="text-stone-500 font-mono text-sm max-w-sm">
        Payments are coming soon. In the meantime, reach out and we will set up your premium plan
        manually.
      </p>
      <a
        href="mailto:hello@thefriendarchive.com"
        className="font-mono text-sm text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider"
      >
        Contact us →
      </a>
    </div>
  );
}
