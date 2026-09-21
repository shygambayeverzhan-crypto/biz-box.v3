import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-white/60">
          {label} {required && <span className="text-danger-400">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-2xs text-white/40">{hint}</p>}
      {error && <p className="text-2xs text-danger-400">{error}</p>}
    </div>
  );
}

const baseInput = 'w-full h-10 px-3.5 rounded-xl bg-bg-base border border-border text-sm text-white placeholder-white/30 transition-colors focus:outline-none focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(baseInput, className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(baseInput, 'h-auto py-2.5 resize-none', className)} {...props} />,
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <select ref={ref} className={cn(baseInput, 'appearance-none bg-no-repeat pr-9 cursor-pointer', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff60' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 0.75rem center' }}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
);
Select.displayName = 'Select';
