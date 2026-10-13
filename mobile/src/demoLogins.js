/** Seeded demo accounts. OTP is the development code from the API. */
export const DEMO_LOGINS = [
  {
    role: 'resident',
    label: 'Resident',
    name: 'Rahul Verma',
    phone: '9000000003',
    otp: '123456',
    icon: 'home-outline',
  },
  {
    role: 'security',
    label: 'Security',
    name: 'Priya Menon',
    phone: '9000000002',
    otp: '123456',
    icon: 'shield-outline',
  },
  {
    role: 'admin',
    label: 'Admin',
    name: 'Aarav Sharma',
    phone: '9000000001',
    otp: '123456',
    icon: 'grid-outline',
  },
];

export function demoLoginFor(role) {
  return DEMO_LOGINS.find((item) => item.role === role) || null;
}
