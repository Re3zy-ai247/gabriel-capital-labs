'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Stats {
  totalUsers: number;
  totalLetters: number;
  totalReports: number;
  premiumUsers: number;
  mrr: number;
  conversionRate: number;
}

export default function AdminDashboard() {
  const { status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status !== 'authenticated') return;

    fetch('/api/admin/stats')
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data) setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [status, router]);

  if (status !== 'authenticated') return null;
  if (loading) return <div className="min-h-screen bg-slate-950 text-white p-8">Loading…</div>;

  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <h1 className="text-3xl font-bold mb-3">Admin Dashboard</h1>
        <p className="text-slate-400">Your account doesn&apos;t have admin access.</p>
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, color: 'text-white' },
    { label: 'Premium Subscribers', value: stats?.premiumUsers ?? 0, color: 'text-emerald-400' },
    { label: 'Monthly Recurring Revenue', value: `$${(stats?.mrr ?? 0).toLocaleString()}`, color: 'text-emerald-400' },
    { label: 'Free → Premium Conversion', value: `${stats?.conversionRate ?? 0}%`, color: 'text-blue-400' },
    { label: 'Letters Generated', value: stats?.totalLetters ?? 0, color: 'text-blue-400' },
    { label: 'Reports Analyzed', value: stats?.totalReports ?? 0, color: 'text-white' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-900 p-6 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-400">{c.label}</div>
            <div className={`text-3xl font-bold mt-2 ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
        <h2 className="text-xl font-bold mb-3">Notes</h2>
        <p className="text-slate-400 text-sm">
          MRR is computed from active premium subscribers × $99. Subscription state syncs automatically from Stripe via
          webhook. Manage individual customers (refunds, cancellations) in your Stripe Dashboard.
        </p>
      </div>
    </div>
  );
}
