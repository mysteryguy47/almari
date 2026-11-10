import { AuthLanding } from '@/components/AuthLanding';

/** Links from email templates that use {{ .TokenHash }} (they work on any device). */
export default function AuthConfirm() {
  return <AuthLanding />;
}
