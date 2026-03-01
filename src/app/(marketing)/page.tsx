import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🎱</span>
            <span className="text-xl font-black text-slate-800">Pool League Manager</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-900 pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            Manage Your Pool League{' '}
            <span className="text-yellow-300">Like a Pro</span>
          </h1>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Stop juggling spreadsheets. Get automatic schedule generation, real-time standings,
            player stats, and score tracking — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-yellow-400 text-slate-900 font-black rounded-xl text-lg hover:bg-yellow-300 transition-colors"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
          <p className="mt-6 text-emerald-200 text-sm">No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-slate-800 text-center mb-12">
            Everything You Need to Run Your League
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '📅', title: 'Auto Schedule Generation', desc: 'Round-robin schedules with one click. Handles byes, venues, and position nights.' },
              { icon: '📊', title: 'Live Standings', desc: 'Real-time team and player stats. Win percentages and automatic rankings.' },
              { icon: '📱', title: 'Easy Score Entry', desc: 'Captains submit from their phone. Dual-submission ensures accuracy.' },
              { icon: '👥', title: 'Team Management', desc: 'Manage rosters, assign captains, track player stats per season.' },
              { icon: '🏆', title: 'Position Nights', desc: 'Automatic playoff matchups based on standings — calculated for you.' },
              { icon: '📜', title: 'Season History', desc: 'Full records of past seasons. Switch between them easily.' },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-8 shadow-lg border-2 border-slate-100 hover:-translate-y-1 transition-transform">
                <div className="text-5xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{f.title}</h3>
                <p className="text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-emerald-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-black mb-4">Ready to get started?</h2>
          <p className="text-emerald-100 text-lg mb-8">Set up your league in under a minute.</p>
          <Link
            href="/signup"
            className="px-8 py-4 bg-white text-emerald-700 font-black rounded-xl text-lg hover:bg-emerald-50 transition-colors inline-block"
          >
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 px-4 text-center text-sm">
        &copy; {new Date().getFullYear()} Pool League Manager. All rights reserved.
      </footer>
    </div>
  );
}
