import { CheckIcon } from "@heroicons/react/20/solid";

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  completedSteps?: number[];
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  completedSteps = [],
  className = "",
}: StepperProps) {
  return (
    <nav className={className} aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = completedSteps.includes(stepNumber);
          const isCurrent = stepNumber === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.label}
              className={`flex items-center ${isLast ? "" : "flex-1"}`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isCompleted
                      ? "bg-primary text-white"
                      : isCurrent
                        ? "border-2 border-primary text-primary"
                        : "border-2 border-gray-300 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    stepNumber
                  )}
                </div>
                <div className="mt-1.5 text-center">
                  <p
                    className={`text-xs font-medium ${
                      isCurrent || isCompleted ? "text-primary" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-400">{step.description}</p>
                  )}
                </div>
              </div>

              {!isLast && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    isCompleted ? "bg-primary" : "bg-gray-300"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
