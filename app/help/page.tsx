'use client';

import Link from 'next/link';

const guides = [
  {
    title: 'Getting Started',
    icon: '🚀',
    items: [
      { title: 'Create Your Account', description: 'Sign up in 2 minutes and get started' },
      { title: 'Complete Your Profile', description: 'Add your name and address for dispute letters' },
      { title: 'Upload Your Reports', description: 'Download free reports from AnnualCreditReport.com' },
    ],
  },
  {
    title: 'Dispute Letters',
    icon: '📄',
    items: [
      { title: 'How to Generate Letters', description: 'Step-by-step guide to creating dispute letters' },
      { title: 'Choosing the Right Strategy', description: 'Pick the best dispute approach for each item' },
      { title: 'Submitting Your Letters', description: 'Tips for mailing and tracking your disputes' },
    ],
  },
  {
    title: 'Tracking Progress',
    icon: '📊',
    items: [
      { title: 'Understanding the 90-Day Journey', description: 'How credit disputes are resolved over time' },
      { title: 'Reading Your Reports', description: 'How to interpret changes in your credit reports' },
      { title: 'Checking Dispute Status', description: 'Monitor what\'s being fixed across bureaus' },
    ],
  },
  {
    title: 'Billing & Account',
    icon: '💳',
    items: [
      { title: 'Premium Subscription', description: 'What\'s included in our $99/month plan' },
      { title: 'Managing Your Subscription', description: 'Upgrade, downgrade, or cancel anytime' },
      { title: 'Your Account Settings', description: 'Update profile, email, and preferences' },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold mb-4">Help & Support</h1>
        <p className="text-xl text-slate-400 mb-12">
          Find guides, answers, and support for using Gabriel Capital Labs
        </p>

        {/* Search */}
        <div className="mb-16">
          <input
            type="text"
            placeholder="Search help topics..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-6 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Guides Grid */}
        <div className="grid md:grid-cols-2 gap-12">
          {guides.map((guide) => (
            <div key={guide.title}>
              <div className="text-4xl mb-4">{guide.icon}</div>
              <h2 className="text-2xl font-bold mb-6">{guide.title}</h2>

              <div className="space-y-4">
                {guide.items.map((item) => (
                  <button
                    key={item.title}
                    className="w-full text-left bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition"
                  >
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-sm text-slate-400 mt-1">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Support */}
        <div className="mt-16 bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border border-slate-700 rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Still need help?</h2>
          <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
            Our support team is here to help. Premium members get priority email support within 24 hours.
          </p>
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-lg font-semibold transition">
            Contact Support
          </button>
        </div>

        {/* Quick Tips */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-8">Pro Tips</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-2xl mb-3">💡</div>
              <h3 className="font-bold mb-2">Start with Free Tier</h3>
              <p className="text-slate-400 text-sm">
                Try the free tier (3 letters/month) to get familiar with the system before upgrading.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-bold mb-2">Use the Strategist</h3>
              <p className="text-slate-400 text-sm">
                Our AI-powered strategist prioritizes which items to dispute first for maximum impact.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-2xl mb-3">⏰</div>
              <h3 className="font-bold mb-2">Follow the 90-Day Journey</h3>
              <p className="text-slate-400 text-sm">
                Most disputes are resolved within 30-90 days. Check the journey tab to track progress.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
