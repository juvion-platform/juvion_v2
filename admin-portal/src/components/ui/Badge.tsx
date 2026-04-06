import clsx from 'clsx';

// Badge color variants matching old Juvion palette
const VARIANTS: Record<string, string> = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-[#D1FAE5] text-[#065F46]',
  warning: 'bg-[#FEF3C7] text-[#92400E]',
  danger:  'bg-[#FEE2E2] text-[#991B1B]',
  info:    'bg-[#DBEAFE] text-[#1E40AF]',
  purple:  'bg-[#EDE9FE] text-[#5B21B6]',
  teal:    'bg-[#CCFBF1] text-[#0F766E]',
  orange:  'bg-[#FFF7ED] text-[#C2410C]',
};

export default function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) {
  return (
    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', VARIANTS[variant] || VARIANTS.default)}>
      {children}
    </span>
  );
}
