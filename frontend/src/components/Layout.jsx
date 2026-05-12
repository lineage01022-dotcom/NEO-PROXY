import Sidebar from "@/components/Sidebar";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      {/* ambient glows */}
      <div className="ambient-glow w-[480px] h-[480px] bg-indigo-700/30 top-[-160px] left-[-120px]" />
      <div className="ambient-glow w-[600px] h-[600px] bg-purple-700/20 bottom-[-200px] right-[-160px]" />
      <div className="fixed inset-0 grid-pattern pointer-events-none" />

      <Sidebar />
      <main className="relative flex-1 p-5 lg:p-8 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto fade-in">{children}</div>
      </main>
    </div>
  );
}
