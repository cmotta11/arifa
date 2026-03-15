import { type InputHTMLAttributes, forwardRef } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, id, className = "", ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={className}>
        <div className="flex items-start gap-2">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            aria-invalid={!!error}
            aria-describedby={
              error ? `${checkboxId}-error` : description ? `${checkboxId}-desc` : undefined
            }
            {...props}
          />
          <div>
            <label htmlFor={checkboxId} className="text-sm font-medium text-gray-700">
              {label}
            </label>
            {description && (
              <p id={`${checkboxId}-desc`} className="text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>
        </div>
        {error && (
          <p id={`${checkboxId}-error`} className="mt-1 text-sm text-error">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
