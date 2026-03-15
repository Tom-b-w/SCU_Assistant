export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#C41230] via-[#9E0E26] to-[#1a0a12] animate-gradient" />

      {/* Decorative floating orbs */}
      <div className="fixed top-20 left-10 h-72 w-72 rounded-full bg-[#D4A843]/20 blur-3xl animate-float" />
      <div className="fixed bottom-20 right-10 h-96 w-96 rounded-full bg-[#C41230]/15 blur-3xl animate-float [animation-delay:3s]" />
      <div className="fixed top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-2xl animate-float [animation-delay:1.5s]" />

      {/* Grid pattern overlay */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
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
