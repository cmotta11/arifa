import type { ReactNode } from "react";

interface PrintLayoutProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PrintLayout({ header, footer, children, className = "" }: PrintLayoutProps) {
  return (
    <>
      <style>{`
        @media print {
          nav, aside, .no-print { display: none !important; }
          .print-layout { margin: 0; padding: 0; }
        }
      `}</style>
      <div className={`print-layout mx-auto max-w-4xl bg-white p-6 ${className}`}>
        {header && <div className="mb-6 border-b border-gray-200 pb-4">{header}</div>}
        <div>{children}</div>
        {footer && <div className="mt-6 border-t border-gray-200 pt-4">{footer}</div>}
      </div>
    </>
  );
}
