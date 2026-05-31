import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-950 px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-stone-100">Reset password</h1>
          <p className="text-stone-500 text-sm font-mono">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>
        <ResetPasswordForm />
        <p className="text-center text-stone-600 text-sm font-mono">
          Remembered it?{' '}
          <a href="/login" className="text-amber-500 hover:text-amber-400 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
