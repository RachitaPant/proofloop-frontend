import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

const fieldBase =
  'w-full px-3.5 py-2 text-sm bg-white border border-surface-300 rounded-md text-navy-900 placeholder:text-navy-300 transition-colors duration-150 focus:outline-none focus:border-brand-500 focus:shadow-focus disabled:bg-surface-50 disabled:text-navy-300';

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-sm font-medium text-navy-700 mb-1.5">
    {children}
    {required && <span className="text-danger-500 ml-0.5">*</span>}
  </label>
);

export const FieldError = ({ error }: { error?: string }) =>
  error ? <p className="mt-1.5 text-xs text-danger-600">{error}</p> : null;

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapperProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, className, id, ...props }, ref) => (
    <div>
      {label && (
        <Label required={required}>
          {label}
        </Label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(fieldBase, error && 'border-danger-400 focus:border-danger-500', className)}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-navy-400">{hint}</p>}
      <FieldError error={error} />
    </div>
  ),
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapperProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, required, className, ...props }, ref) => (
    <div>
      {label && <Label required={required}>{label}</Label>}
      <textarea ref={ref} className={cn(fieldBase, 'resize-none', error && 'border-danger-400', className)} {...props} />
      {hint && !error && <p className="mt-1.5 text-xs text-navy-400">{hint}</p>}
      <FieldError error={error} />
    </div>
  ),
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldWrapperProps {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, required, className, children, ...props }, ref) => (
    <div>
      {label && <Label required={required}>{label}</Label>}
      <select ref={ref} className={cn(fieldBase, 'cursor-pointer', error && 'border-danger-400', className)} {...props}>
        {children}
      </select>
      {hint && !error && <p className="mt-1.5 text-xs text-navy-400">{hint}</p>}
      <FieldError error={error} />
    </div>
  ),
);
Select.displayName = 'Select';
