'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }

    // Fetch admin stats
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [session, router]);

  if (!session) return null;
  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400">Total Users</div>
          <div className="text-3xl font-bold mt-2">{stats?.totalUsers || 0}</div>
        </div>

        <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400">Letters Generated</div>
          <div className="text-3xl font-bold mt-2 text-blue-500">{stats?.totalLetters || 0}</div>
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-bold mb-4">Features Coming Soon</h2>
        <ul className="space-y-2 text-slate-300">
          <li>✓ User management</li>
          <li>✓ Subscription tracking</li>
          <li>✓ Revenue analytics</li>
          <li>✓ Letter approval system</li>
          <li>✓ Compliance reporting</li>
        </ul>
      </div>
    </div>
  );
}
