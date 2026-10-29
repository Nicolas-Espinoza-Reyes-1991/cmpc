import type { ReactNode } from 'react';
import { errorId } from '../lib/form-attributes';

interface FormFieldProps {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactNode;
}

/** A labelled field with its error message underneath. The input goes in `children`. */
export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId(id)} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
