import { redirect } from 'next/navigation';

// Legacy login page — redirect to NextAuth sign-in
export default function LoginPage() {
  redirect('/auth/signin');
}
