import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = await isAdmin(session.user.email);
    if (!admin) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const totalUsers = await prisma.user.count();
    const totalLetters = await prisma.letter.count();

    return Response.json({
      totalUsers,
      totalLetters,
      message: 'Admin stats - billing coming soon',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
