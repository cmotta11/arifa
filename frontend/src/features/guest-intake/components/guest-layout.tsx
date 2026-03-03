export function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-light">
      {/* Minimal header */}
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4">
          <span className="text-xl font-bold text-arifa-navy">ARIFA</span>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-white py-4">
        <div className="mx-auto max-w-4xl px-4 text-center text-xs text-gray-400">
          ARIFA &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
