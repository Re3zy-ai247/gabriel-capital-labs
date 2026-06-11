import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { PREMIUM_PRICE_CENTS } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = await isAdmin(session.user.email);
    if (!admin) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const [totalUsers, totalLetters, totalReports, premiumUsers] = await Promise.all([
      prisma.user.count(),
      prisma.letter.count(),
      prisma.report.count(),
      prisma.user.count({ where: { plan: 'premium' } }),
    ]);

    const mrrCents = premiumUsers * PREMIUM_PRICE_CENTS;

    return Response.json({
      totalUsers,
      totalLetters,
      totalReports,
      premiumUsers,
      mrr: mrrCents / 100,
      conversionRate: totalUsers ? Math.round((premiumUsers / totalUsers) * 1000) / 10 : 0,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
