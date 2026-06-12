import { useState, useRef, useEffect } from 'react'
import {
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Building2,
  UserPlus,
  Settings,
  LayoutDashboard,
  LogOut,
  Trash2,
  Key,
  Copy,
  Check,
  Boxes,
  Users,
} from 'lucide-react'
import PatientList from './patients/PatientList'

interface Org {
  org_id: string | number
  org_name: string
  timezone: string
}

interface HomePageProps {
  selectedOrg: Org | null
  orgs: Org[]
  userAvatar: string
  userName: string
  userEmail: string
  onCreateOrg: () => void
  onSignOut: () => void
  onSelectOrg: (org: Org) => void
  onDeleteOrg: (org: Org) => Promise<void>
  currentUser: Record<string, unknown> | null
  accessToken: string
  modules: Record<string, unknown>[]
  profilePermissions: Record<string, unknown>[]
}

export default function HomePage({
  selectedOrg,
  orgs,
  userAvatar,
  userName,
  userEmail,
  onCreateOrg,
  onSignOut,
  onSelectOrg,
  onDeleteOrg,
  currentUser,
  accessToken,
  modules,
  profilePermissions,
}: HomePageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [selectedNav, setSelectedNav] = useState<string>('dashboard')
  const [openPatientCreateSignal, setOpenPatientCreateSignal] = useState(0)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const createMenuRef = useRef<HTMLDivElement>(null)

  // Build visible nav items:
  // If profilePermissions is empty (null/admin) → show all modules.
  // Otherwise → only modules where the profile has read: true.
  const allowedModuleNames: Set<string> = profilePermissions.length === 0
    ? new Set(modules.map(m => m.module_api_name as string))
    : new Set(
        profilePermissions
          .filter(p => p.read === true)
          .map(p => p.module as string)
      )

  const navModules = modules.filter(
    m => allowedModuleNames.has(m.module_api_name as string)
  )

  // Close profile menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayName = (currentUser?.name as string) || userName
  const avatarInitial = (displayName || userEmail || 'U')[0].toUpperCase()
  const multiOrg = orgs.length > 1

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Full-width Top Bar ────────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-[#e2e2e2] flex items-center shrink-0 z-30">

        {/* Left cell: logo + toggle — mirrors sidebar width */}
        <div
          className={`
            flex items-center gap-3 px-4 shrink-0 h-full bg-[#f8f9fd]
            transition-all duration-200 overflow-hidden
            ${sidebarOpen ? 'w-64' : 'w-14'}
          `}
        >
          {/* TakeCare Logo — fades out when sidebar collapses */}
          <div
            className={`flex items-center gap-2 flex-1 min-w-0 transition-opacity duration-150 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <div className="h-8 w-8 rounded-lg bg-[#0f172a] flex items-center justify-center shrink-0">
              <div className="relative h-4 w-4">
                <span className="absolute left-[6px] top-0 h-4 w-[3px] rounded-full bg-cyan-300" />
                <span className="absolute left-0 top-[6px] h-[3px] w-4 rounded-full bg-cyan-400" />
                <span className="absolute left-[7px] top-[7px] h-[5px] w-[5px] rounded-full bg-cyan-100" />
              </div>
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              TakeCare
            </span>
          </div>

          {/* Sidebar toggle — hidden for now */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition shrink-0"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Right cell: search (centered) + right actions */}
        <div className="flex flex-1 items-center px-4 gap-3 min-w-0 h-full">

          {/* Search box */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search or type a command"
                className="w-full pl-9 pr-14 py-2 bg-[#faf9ff] border border-[#e8e8f0] rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#eeeeff] transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
                <kbd className="px-1.5 py-0.5 bg-white border border-[#e8e8f0] rounded text-[10px] text-gray-400 font-sans">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-white border border-[#e8e8f0] rounded text-[10px] text-gray-400 font-sans">K</kbd>
              </span>
            </div>
          </div>

          {/* Org name / selector */}
          {selectedOrg && (
            multiOrg ? (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-[#eeeeff] border border-[#e8e8f0] rounded-lg shrink-0">
                <select
                  className="bg-transparent text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer"
                  value={String(selectedOrg.org_id)}
                  onChange={(e) => {
                    const org = orgs.find((o) => String(o.org_id) === e.target.value)
                    if (org) onSelectOrg(org)
                  }}
                >
                  {orgs.map((o) => (
                    <option key={o.org_id} value={String(o.org_id)}>
                      {o.org_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="px-3 py-1.5 bg-[#eeeeff] border border-[#e8e8f0] rounded-lg text-sm font-semibold text-gray-700 whitespace-nowrap shrink-0">
                {selectedOrg.org_name}
              </span>
            )
          )}

          {/* Create (+) */}
          <div className="relative shrink-0" ref={createMenuRef}>
            <button
              type="button"
              onClick={() => setCreateMenuOpen((v) => !v)}
              title="Create new"
              aria-label="Create menu"
              aria-expanded={createMenuOpen}
              className="p-2 rounded-lg bg-[#7677f1] text-white hover:bg-[#6566e0] transition"
            >
              <Plus className="w-4 h-4" />
            </button>

            {createMenuOpen && (
              <div className="absolute right-0 top-11 w-44 bg-white rounded-xl shadow-lg border border-[#e2e2e2] py-1.5 z-50">
                <div className="px-3 pb-1 pt-1.5">
                  <p className="text-[11px] font-bold tracking-[0.12em] text-gray-500 uppercase">Quick Add</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    onCreateOrg()
                  }}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#eeeeff] hover:text-[#7c3aed] transition"
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  Add Hospital
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    if (!selectedOrg) return
                    setSelectedNav('patients')
                    setOpenPatientCreateSignal((v) => v + 1)
                  }}
                  disabled={!selectedOrg}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#eeeeff] hover:text-[#7c3aed] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  Add Patient
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            type="button"
            title="Settings"
            className="p-2 rounded-lg text-gray-500 hover:text-[#7c3aed] hover:bg-[#eeeeff] transition shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Profile avatar + dropdown */}
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#e8e8f0] hover:border-[#7c3aed] transition focus:outline-none"
              aria-label="Profile menu"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold">
                  {avatarInitial}
                </div>
              )}
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-white rounded-xl shadow-lg border border-[#e2e2e2] py-2 z-50">
                <div className="px-4 py-2 border-b border-[#e2e2e2]">
                  <p className="text-sm font-semibold text-gray-800 truncate">{displayName || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    onSignOut()
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-[#eeeeff] hover:text-[#7c3aed] transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
                {selectedOrg && (
                  <>
                    <div className="border-t border-[#e2e2e2] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false)
                        onDeleteOrg(selectedOrg)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Org
                    </button>
                  </>
                )}
                {accessToken && (
                  <>
                    <div className="border-t border-[#e2e2e2] my-1" />
                    <div className="px-4 py-2.5">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                        <Key className="w-3 h-3" />
                        Access Token
                      </p>
                      <div className="flex items-center gap-1.5 bg-[#f5f5f9] border border-[#e8e8f0] rounded-lg px-2 py-1.5">
                        <code className="text-[10px] text-gray-500 flex-1 truncate font-mono">
                          {accessToken.slice(0, 28)}…
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(accessToken)
                            setTokenCopied(true)
                            setTimeout(() => setTokenCopied(false), 2000)
                          }}
                          className="shrink-0 p-0.5 rounded text-gray-400 hover:text-[#7c3aed] transition"
                          title="Copy full access token"
                        >
                          {tokenCopied ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar */}
        <aside
          className={`
            flex flex-col bg-[#f8f9fd] shrink-0 overflow-hidden
            transition-all duration-200 ease-in-out
            ${sidebarOpen ? 'w-64' : 'w-0'}
          `}
        >
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {/* Dashboard — always first */}
            <button
              type="button"
              onClick={() => setSelectedNav('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                selectedNav === 'dashboard'
                  ? 'bg-[#eeeeff] text-gray-900'
                  : 'text-gray-600 hover:bg-[#f0f0fb] hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Dashboard</span>
            </button>

            {/* Patients */}
            <button
              type="button"
              onClick={() => setSelectedNav('patients')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                selectedNav === 'patients'
                  ? 'bg-[#eeeeff] text-gray-900'
                  : 'text-gray-600 hover:bg-[#f0f0fb] hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Patients</span>
            </button>

            {/* Dynamic module nav items */}
            {modules.length === 0 ? (
              // Loading skeleton — shown while modules are still fetching
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                >
                  <div className="w-4 h-4 rounded bg-gray-200 animate-pulse shrink-0" />
                  <div
                    className="h-3 rounded bg-gray-200 animate-pulse"
                    style={{ width: `${48 + (i % 3) * 20}%` }}
                  />
                </div>
              ))
            ) : (
              navModules.map(mod => {
                const key = mod.module_api_name as string
                const label = mod.name as string
                const isActive = selectedNav === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedNav(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#eeeeff] text-gray-900 font-semibold'
                        : 'text-gray-600 hover:bg-[#f0f0fb] hover:text-gray-900'
                    }`}
                  >
                    <Boxes className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap truncate">{label}</span>
                  </button>
                )
              })
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-white">
          {selectedNav === 'patients' && selectedOrg && (
            <PatientList
              accessToken={accessToken}
              orgId={String(selectedOrg.org_id)}
              organizationName={selectedOrg.org_name}
              openCreateSignal={openPatientCreateSignal}
            />
          )}
        </main>
      </div>

    </div>
  )
}
