'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signup } from './actions';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signup(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎱</div>
          <h1 className="text-3xl font-black text-slate-800">Start Your League</h1>
          <p className="text-slate-600">14-day free trial, no credit card required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="leagueName" className="block text-sm font-medium text-slate-700 mb-1">
              League Name
            </label>
            <input
              id="leagueName"
              name="leagueName"
              type="text"
              required
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
              placeholder="Cedar Rapids Pool League"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              Your Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
              Phone (optional)
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
              placeholder="(319) 555-0123"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
              placeholder="Minimum 8 characters"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating your league...' : 'Start Free Trial →'}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-600">
          Already have a league?{' '}
          <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
