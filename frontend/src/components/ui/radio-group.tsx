import { RadioGroup as HeadlessRadioGroup, Radio, Field, Label, Description } from "@headlessui/react";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  label?: string;
  error?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  label,
  error,
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: RadioGroupProps) {
  return (
    <HeadlessRadioGroup
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
    >
      {label && (
        <Label className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </Label>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <Field key={option.value}>
            <Radio
              value={option.value}
              className="group flex cursor-pointer items-start gap-2"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-300 group-data-[checked]:border-primary group-data-[checked]:bg-primary">
                <span className="hidden h-1.5 w-1.5 rounded-full bg-white group-data-[checked]:block" />
              </span>
              <div>
                <Label className="text-sm font-medium text-gray-700 group-data-[disabled]:text-gray-400">
                  {option.label}
                </Label>
                {option.description && (
                  <Description className="text-sm text-gray-500">
                    {option.description}
                  </Description>
                )}
              </div>
            </Radio>
          </Field>
        ))}
      </div>
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
    </HeadlessRadioGroup>
  );
}
