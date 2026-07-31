import Sidebar from './Sidebar'

export default function Layout({ children, title, subtitle, actions }) {
  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur border-b border-ink-900/[0.07] px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-950">{title}</h1>
            {subtitle && <p className="text-sm text-ink-700/60 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
        <div className="px-8 py-7">{children}</div>
      </main>
    </div>
  )
}
