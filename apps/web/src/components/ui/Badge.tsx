import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'buy' | 'watch' | 'avoid' | 'outline';
}

const variantClasses = {
  default: 'bg-primary text-white',
  buy: 'text-green-700 bg-green-100 border-green-300',
  watch: 'text-amber-700 bg-amber-100 border-amber-300',
  avoid: 'text-red-700 bg-red-100 border-red-300',
  outline: 'border bg-transparent',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
