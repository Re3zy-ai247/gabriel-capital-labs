'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function BillingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-slate-400 mb-12">Manage your account and payment settings</p>

        {/* Current Plan */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Your Current Plan</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="text-slate-400 text-sm mb-2">PLAN TYPE</div>
              <div className="text-3xl font-bold mb-6">Premium Plan</div>
              <p className="text-slate-400 mb-6">
                You have unlimited access to all features including dispute letter generation, AI refinement, and priority support.
              </p>
              <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition">
                Cancel Subscription
              </button>
            </div>

            <div className="bg-slate-800 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <div className="text-slate-400 text-sm">Monthly Cost</div>
                  <div className="text-2xl font-bold">$99.00</div>
                </div>
                <div className="border-t border-slate-700 pt-4">
                  <div className="text-slate-400 text-sm">Next Billing Date</div>
                  <div className="text-lg font-semibold">July 10, 2024</div>
                </div>
                <div className="border-t border-slate-700 pt-4">
                  <div className="text-slate-400 text-sm">Member Since</div>
                  <div className="text-lg font-semibold">June 10, 2024</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* What's Included */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">What's Included</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <span className="text-emerald-500 text-2xl flex-shrink-0">✓</span>
              <div>
                <div className="font-semibold">Unlimited Dispute Letters</div>
                <p className="text-slate-400 text-sm">Generate as many professional dispute letters as you need</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-emerald-500 text-2xl flex-shrink-0">✓</span>
              <div>
                <div className="font-semibold">AI-Powered Refinement</div>
                <p className="text-slate-400 text-sm">Let our AI improve your letters for maximum impact</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-emerald-500 text-2xl flex-shrink-0">✓</span>
              <div>
                <div className="font-semibold">90-Day Progress Tracking</div>
                <p className="text-slate-400 text-sm">Monitor improvements across all three credit bureaus</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-emerald-500 text-2xl flex-shrink-0">✓</span>
              <div>
                <div className="font-semibold">Priority Support</div>
                <p className="text-slate-400 text-sm">Get help when you need it with priority email support</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Payment Method</h2>

          <div className="bg-slate-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-2">VISA ending in 4242</div>
                <div className="text-lg font-semibold">Expires 12/25</div>
              </div>
              <button className="text-emerald-500 hover:text-emerald-400 font-semibold">Update</button>
            </div>
          </div>

          <p className="text-slate-400 text-sm">
            Your payment method is secure and encrypted. You'll be charged $99.00 on your next billing date unless you cancel.
          </p>
        </div>

        {/* Billing History */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Billing History</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-4 border-b border-slate-800 last:border-0">
              <div>
                <div className="font-semibold">Premium Subscription</div>
                <div className="text-sm text-slate-400">June 10, 2024</div>
              </div>
              <div className="font-semibold">$99.00</div>
            </div>
          </div>

          <p className="text-slate-400 text-sm mt-6">
            You'll see all past and upcoming invoices here. Receipts are automatically sent to your email.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 bg-slate-900 border border-slate-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Billing FAQ</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">When will I be charged?</h3>
              <p className="text-slate-400 text-sm">You'll be charged on the same day each month. Your next charge is July 10, 2024.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Can I change my plan?</h3>
              <p className="text-slate-400 text-sm">
                Contact support to explore other plan options. We're currently offering the Premium plan at $99/month.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">What happens if I cancel?</h3>
              <p className="text-slate-400 text-sm">
                You'll have access through the end of your current billing period. After that, you can still use the free tier (3 letters/month).
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-slate-400 text-sm">
                We offer a 30-day money-back guarantee. If you're not satisfied, we'll refund your first month.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
