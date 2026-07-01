import { redirect } from 'next/navigation';
import { getSession } from '@/lib/services/auth';

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  } else {
    redirect('/modules');
  }
}
