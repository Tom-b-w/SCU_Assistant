export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#D11A37] via-[#B3122E] to-[#781728] animate-gradient" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_36%),radial-gradient(circle_at_82%_78%,rgba(212,168,67,0.16),transparent_28%)]" />

      {/* Decorative floating orbs */}
      <div className="fixed top-20 left-10 h-72 w-72 rounded-full bg-[#D4A843]/28 blur-[120px] animate-float" />
      <div className="fixed bottom-20 right-10 h-96 w-96 rounded-full bg-[#E3455D]/20 blur-[140px] animate-float [animation-delay:3s]" />
      <div className="fixed top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF3F5]/10 blur-3xl animate-float [animation-delay:1.5s]" />

      {/* Grid pattern overlay */}
      <div
        className="fixed inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full px-4">
        {children}
      </div>
    </div>
  );
}
