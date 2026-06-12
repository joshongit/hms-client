import { useState, useEffect, useRef, useCallback } from 'react'
import { useLogto, useHandleSignInCallback } from '@logto/react'
import {
  ArrowRight,
  Play,
  Sun,
} from 'lucide-react'
import OrgOnboarding from './components/OrgOnboarding'
import HomePage from './components/HomePage'

// Constants
const BACKEND_BASE_URL = "https://hms.appblocks.in"
const APP_ORIGIN = window.location.origin
const SIGN_IN_REDIRECT_URI = import.meta.env.VITE_LOGTO_REDIRECT_URI?.trim() || `${APP_ORIGIN}/callback`
const SIGN_OUT_REDIRECT_URI = import.meta.env.VITE_LOGTO_POST_LOGOUT_REDIRECT_URI?.trim() || APP_ORIGIN
const LOGOUT_IN_PROGRESS_KEY = 'hms_logout_in_progress_v1'
const LOCAL_STORAGE_STEP_KEY = 'hms_onboarding_step_v1'
const LOCAL_STORAGE_ORG_KEY = 'hms_onboarding_created_org_v1'

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (GMT-05:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-08:00)" },
  { value: "Europe/London", label: "Europe/London (GMT+00:00)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (GMT+01:00)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (GMT+05:30)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (GMT+08:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (GMT+10:00)" }
]

interface Org {
  org_id: string | number;
  org_name: string;
  timezone: string;
}

// Callback route component
function CallbackDNALoader() {
  const n = 9, dur = 1.8, base = 13
  const pink = ['#fda4af', '#fb7185', '#e879f9', '#d946ef', '#f472b6']
  const blue = ['#c7d2fe', '#93c5fd', '#818cf8', '#6366f1', '#8b5cf6']
  return (
    <div style={{ position: 'relative', width: '250px', height: '72px' }}>
      <style>{`
        @keyframes dna-cb-s1 { 0%,100%{transform:translateY(22px) scale(1.4);opacity:1} 50%{transform:translateY(-22px) scale(0.5);opacity:0.4} }
        @keyframes dna-cb-s2 { 0%,100%{transform:translateY(-22px) scale(0.5);opacity:0.4} 50%{transform:translateY(22px) scale(1.4);opacity:1} }
      `}</style>
      {Array.from({ length: n }, (_, i) => (
        <div key={`b${i}`} style={{ position:'absolute', left: 12+(i/(n-1))*226 - base/2, top:'50%', marginTop:-base/2, width:base, height:base, borderRadius:'50%', background:blue[i%blue.length], animation:`dna-cb-s2 ${dur}s ease-in-out infinite`, animationDelay:`${-(i/n)*dur}s` }} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <div key={`p${i}`} style={{ position:'absolute', left: 12+(i/(n-1))*226 - base/2, top:'50%', marginTop:-base/2, width:base, height:base, borderRadius:'50%', background:pink[i%pink.length], animation:`dna-cb-s1 ${dur}s ease-in-out infinite`, animationDelay:`${-(i/n)*dur}s` }} />
      ))}
    </div>
  )
}

function Callback() {
  const { isLoading: callbackLoading, error } = useHandleSignInCallback(() => {
    // Primary navigation path (works in non-StrictMode)
    window.location.replace('/')
  })
  // Fallback: watch isAuthenticated directly so StrictMode double-invocation
  // can't leave us stuck — as soon as the SDK marks the session as
  // authenticated we navigate regardless of whether the callback above fired.
  const { isAuthenticated } = useLogto()
  useEffect(() => {
    if (isAuthenticated) {
      window.location.replace('/')
    }
  }, [isAuthenticated])

  // Safety net: if callback hangs due SDK edge cases, return to root and let
  // app state recover there instead of trapping user on an infinite spinner.
  useEffect(() => {
    if (!callbackLoading || isAuthenticated || error) return
    const timer = window.setTimeout(() => {
      console.warn('Sign-in callback timed out, redirecting to home fallback')
      window.location.replace('/')
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [callbackLoading, isAuthenticated, error])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-900 gap-4 p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <div className="text-red-600 font-bold text-lg">Failed to complete sign-in</div>
        <p className="text-gray-500 text-sm max-w-md">{error.message || String(error)}</p>
        <a href="/" className="mt-4 px-6 py-2.5 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 text-white rounded-xl text-sm font-semibold shadow-md shadow-pink-100">
          Return to Home
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-900 gap-6"
      style={{ background: 'linear-gradient(160deg, #fdf0ff 0%, #f5e6fd 50%, #ede0fa 100%)' }}>
      <CallbackDNALoader />
      <div className="text-lg font-semibold text-pink-600 text-center">
        {callbackLoading ? 'Completing secure sign-in…' : 'Finalizing session…'}
      </div>
    </div>
  )
}

function App() {
  const { isAuthenticated, isLoading, signIn, signOut, getIdTokenClaims, getAccessToken } = useLogto()
  const logoutTriggeredRef = useRef(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [userAvatar, setUserAvatar] = useState<string>('')
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState<boolean>(() => {
    return window.sessionStorage.getItem(LOGOUT_IN_PROGRESS_KEY) === '1'
  })
  
  // App States
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [currentUser, setCurrentUser] = useState<Record<string, unknown> | null>(null)
  const [accessToken, setAccessToken] = useState<string>('')
  const [modules, setModules] = useState<Record<string, unknown>[]>([])
  const [profilePermissions, setProfilePermissions] = useState<Record<string, unknown>[]>([])

  // Org Creation Form State
  const [showCreateOrg, setShowCreateOrg] = useState(false)

  // Stays true once onboarding starts — not affected by loadOrgs re-runs
  const [onboardingActive, setOnboardingActive] = useState(false)
  const [isResolvingInitialOrgRoute, setIsResolvingInitialOrgRoute] = useState(false)

  const getApiAccessToken = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      throw new Error('No opaque access token returned')
    }
    return token
  }, [getAccessToken])

  const performSignOut = useCallback(async () => {
    if (SIGN_OUT_REDIRECT_URI) {
      try {
        await signOut(SIGN_OUT_REDIRECT_URI)
        return
      } catch (err) {
        const message = String(err).toLowerCase()
        if (!message.includes('post_logout_redirect_uri not registered')) {
          throw err
        }
        console.warn('Configured post logout redirect URI is not registered. Retrying sign out without redirect URI.')
      }
    }

    await signOut()
  }, [signOut])

  const beginSignOut = useCallback(async () => {
    setLogoutError(null)
    setIsSigningOut(true)
    window.sessionStorage.setItem(LOGOUT_IN_PROGRESS_KEY, '1')

    try {
      await performSignOut()
    } catch (err) {
      setIsSigningOut(false)
      window.sessionStorage.removeItem(LOGOUT_IN_PROGRESS_KEY)
      throw err
    }
  }, [performSignOut])

  // Load User Details
  useEffect(() => {
    if (isAuthenticated) {
      getIdTokenClaims().then((claims) => {
        if (claims) {
          setUserEmail(claims.email || claims.username || (claims.sub as string) || '')
          setUserName((claims.name as string) || claims.username || '')
          setUserAvatar((claims.picture as string) || '')
        }
      }).catch(err => console.error("Error loading user claims", err))
    }
  }, [isAuthenticated, getIdTokenClaims])

  // Load Current User
  useEffect(() => {
    if (!isAuthenticated || !selectedOrg) return
    let cancelled = false
    const fetchCurrentUser = async () => {
      try {
        const token = await getApiAccessToken()
        if (cancelled) return
        setAccessToken(token)
        const res = await fetch(`${BACKEND_BASE_URL}/api/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Org-ID': String(selectedOrg.org_id),
            'Accept': 'application/json'
          }
        })
        if (!res.ok) throw new Error(`GET /api/users/me failed: ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setCurrentUser(data)
        console.log('GET /api/users/me response:', data)
      } catch (err) {
        console.error('Failed to fetch current user', err)
      }
    }
    fetchCurrentUser()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedOrg?.org_id])

  // Load Modules + Profile Permissions once currentUser is known
  useEffect(() => {
    if (!isAuthenticated || !selectedOrg || !currentUser) return
    let cancelled = false
    const orgId = String(selectedOrg.org_id)
    const profileId = currentUser.profile_id as string | undefined

    const fetchMenuData = async () => {
      try {
        const token = await getApiAccessToken()
        if (cancelled) return

        // 1. Fetch modules
        const modulesRes = await fetch(`${BACKEND_BASE_URL}/api/modules`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Org-ID': orgId,
            'Accept': 'application/json'
          }
        })
        if (!modulesRes.ok) throw new Error(`GET /api/modules failed: ${modulesRes.status}`)
        const modulesData = await modulesRes.json()
        if (cancelled) return
        setModules(Array.isArray(modulesData) ? modulesData : [])
        console.log('GET /api/modules response:', modulesData)

        // 2. Fetch profile permissions (only if profile_id is available)
        if (profileId) {
          const permsRes = await fetch(`${BACKEND_BASE_URL}/api/profiles/${profileId}/permissions`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Org-ID': orgId,
              'Accept': 'application/json'
            }
          })
          if (!permsRes.ok) throw new Error(`GET /api/profiles/${profileId}/permissions failed: ${permsRes.status}`)
          const permsData = await permsRes.json()
          if (cancelled) return
          setProfilePermissions(Array.isArray(permsData) ? permsData : [])
          console.log(`GET /api/profiles/${profileId}/permissions response:`, permsData)
        } else {
          console.warn('No profile_id on currentUser — skipping permissions fetch')
        }
      } catch (err) {
        console.error('Failed to fetch menu data', err)
      }
    }
    fetchMenuData()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedOrg?.org_id, currentUser?.api_id])

  // Load Orgs
  useEffect(() => {
    let cancelled = false
    if (isAuthenticated) {
      setIsResolvingInitialOrgRoute(true)
      loadOrgs().finally(() => {
        if (!cancelled) {
          setIsResolvingInitialOrgRoute(false)
        }
      })
    } else {
      setIsResolvingInitialOrgRoute(false)
      setOnboardingActive(false)
      setOrgs([])
      setSelectedOrg(null)
    }

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])



  const loadOrgs = async () => {
    try {
      const token = await getApiAccessToken()
      const res = await fetch(`${BACKEND_BASE_URL}/api/orgs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      console.debug('GET /api/orgs response:', data)
      if (Array.isArray(data)) {
        setOrgs(data)
        if (data.length === 0) setOnboardingActive(true)
        if (data.length > 0) {
          setSelectedOrg(data[0])
        } else {
          setSelectedOrg(null)
        }
      } else if (data == null) {
        setOrgs([])
        setSelectedOrg(null)
        setOnboardingActive(true)
      } else {
        setOrgs([])
        setSelectedOrg(null)
        console.error('Unexpected organizations response format.')
      }
    } catch (err) {
      console.error("Failed to load organizations", err)
    }
  }

  const handleDeleteOrg = async (orgToDelete: Org) => {
    if (!orgToDelete || !orgToDelete.org_id) return
    try {
      const token = await getApiAccessToken()
      const res = await fetch(`${BACKEND_BASE_URL}/api/orgs`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Org-ID': String(orgToDelete.org_id),
          'Accept': 'application/json'
        }
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      localStorage.removeItem(LOCAL_STORAGE_STEP_KEY)
      localStorage.removeItem(LOCAL_STORAGE_ORG_KEY)
      setOrgs(prev => prev.filter(o => o.org_id !== orgToDelete.org_id))
      await loadOrgs()
    } catch (err) {
      console.error("Failed to delete org", err)
    }
  }

  const isLogoutRoute = window.location.pathname === '/logout'

  useEffect(() => {
    if (isAuthenticated || !isSigningOut) {
      return
    }
    setIsSigningOut(false)
    window.sessionStorage.removeItem(LOGOUT_IN_PROGRESS_KEY)
  }, [isAuthenticated, isSigningOut])

  useEffect(() => {
    if (!isLogoutRoute || logoutTriggeredRef.current) {
      return
    }

    logoutTriggeredRef.current = true
    setLogoutError(null)

    beginSignOut().catch((err) => {
      console.error('Failed to sign out', err)
      setLogoutError('Failed to sign out automatically. Please try again.')
      logoutTriggeredRef.current = false
    })
  }, [beginSignOut, isLogoutRoute])

  // Handle /callback route (accept optional trailing slash)
  if (window.location.pathname === '/callback' || window.location.pathname === '/callback/') {
    return <Callback />
  }

  if (isLogoutRoute || isSigningOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-900 gap-6 p-6 text-center"
        style={{ background: 'linear-gradient(160deg, #fdf0ff 0%, #f5e6fd 50%, #ede0fa 100%)' }}>
        <CallbackDNALoader />
        <div className="text-lg font-semibold text-pink-600">
          Signing you out…
        </div>
        {logoutError && (
          <>
            <p className="text-sm text-red-500 max-w-md">{logoutError}</p>
            <button
              onClick={() => {
                beginSignOut().catch((err) => {
                  console.error('Failed to sign out', err)
                  setLogoutError('Failed to sign out automatically. Please try again.')
                })
              }}
              className="mt-2 px-6 py-2.5 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 text-white rounded-xl text-sm font-semibold shadow-md shadow-pink-100"
            >
              Retry Sign Out
            </button>
            <button
              onClick={() => {
                setIsSigningOut(false)
                window.sessionStorage.removeItem(LOGOUT_IN_PROGRESS_KEY)
                window.location.assign('/')
              }}
              className="px-6 py-2.5 border border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 rounded-xl text-sm font-semibold"
            >
              Return Home
            </button>
          </>
        )}
      </div>
    )
  }

  // Show loading spinner while Logto restores session from storage
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-900 gap-6"
        style={{ background: 'linear-gradient(160deg, #fdf0ff 0%, #f5e6fd 50%, #ede0fa 100%)' }}>
        <CallbackDNALoader />
        <div className="text-base font-semibold text-pink-600">Loading TakeCare…</div>
      </div>
    )
  }

  // Render Unauthenticated Landing Page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] text-slate-900 overflow-x-hidden bg-[radial-gradient(#d7d9dc_0.9px,transparent_0.9px)] [background-size:36px_36px]">
        <header className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#0f172a] border border-slate-700/70 shadow-[0_8px_24px_rgba(15,23,42,0.22)] flex items-center justify-center">
              <div className="relative h-5 w-5">
                <span className="absolute left-2 top-0 h-5 w-1 rounded-full bg-cyan-300"></span>
                <span className="absolute left-0 top-2 h-1 w-5 rounded-full bg-cyan-400"></span>
                <span className="absolute left-[9px] top-[9px] h-1.5 w-1.5 rounded-full bg-cyan-100"></span>
              </div>
            </div>
            <span className="text-4xl font-semibold tracking-tight text-slate-900">TakeCare</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              aria-label="Theme settings"
              className="text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Sun className="w-5 h-5" />
            </button>
            <button
              onClick={() => signIn(SIGN_IN_REDIRECT_URI)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-xl font-medium text-white hover:bg-black transition-colors"
            >
              Sign in
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-24 sm:pt-28 lg:pt-36 pb-16 text-center">
          <h1 className="mx-auto max-w-4xl text-[3.8rem] leading-[0.98] tracking-tight font-bold text-slate-950">
            The Smart Operating System
            <br />
            for <span className="bg-gradient-to-r from-fuchsia-500 via-violet-500 to-pink-500 bg-clip-text text-transparent">Modern Healthcare</span>
          </h1>

          <p className="mt-8 text-2xl sm:text-4xl text-slate-600 font-medium">
            Care for what <span className="text-slate-800 font-semibold">matters</span>
          </p>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-3 rounded-2xl bg-slate-950 px-7 py-4 text-xl font-medium text-white shadow-[0_12px_26px_rgba(15,23,42,0.22)] hover:bg-black transition-colors"
            >
              <span className="h-6 w-6 rounded-full border border-white/30 bg-white/10 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 ml-0.5" />
              </span>
              Watch Demo
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (isAuthenticated && isResolvingInitialOrgRoute) {
    const n = 9, dur = 1.8
    const pink = ['#fda4af', '#fb7185', '#e879f9', '#d946ef', '#f472b6']
    const blue = ['#c7d2fe', '#93c5fd', '#818cf8', '#6366f1', '#8b5cf6']
    const base = 13
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6"
        style={{ background: 'linear-gradient(160deg, #fdf0ff 0%, #f9f2ff 45%, #f4ecff 100%)' }}>
        <style>{`
          @keyframes dna-s1 {
            0%, 100% { transform: translateY(22px) scale(1.4); opacity: 1; }
            50%       { transform: translateY(-22px) scale(0.5); opacity: 0.4; }
          }
          @keyframes dna-s2 {
            0%, 100% { transform: translateY(-22px) scale(0.5); opacity: 0.4; }
            50%       { transform: translateY(22px) scale(1.4); opacity: 1; }
          }
        `}</style>
        <div style={{ position: 'relative', width: '250px', height: '72px' }}>
          {Array.from({ length: n }, (_, i) => {
            const x = 12 + (i / (n - 1)) * 226
            const delay = `${-(i / n) * dur}s`
            return (
              <div key={`b${i}`} style={{
                position: 'absolute', left: x - base / 2, top: '50%', marginTop: -base / 2,
                width: base, height: base, borderRadius: '50%',
                background: blue[i % blue.length],
                animation: `dna-s2 ${dur}s ease-in-out infinite`,
                animationDelay: delay,
              }} />
            )
          })}
          {Array.from({ length: n }, (_, i) => {
            const x = 12 + (i / (n - 1)) * 226
            const delay = `${-(i / n) * dur}s`
            return (
              <div key={`p${i}`} style={{
                position: 'absolute', left: x - base / 2, top: '50%', marginTop: -base / 2,
                width: base, height: base, borderRadius: '50%',
                background: pink[i % pink.length],
                animation: `dna-s1 ${dur}s ease-in-out infinite`,
                animationDelay: delay,
              }} />
            )
          })}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Preparing Your Workspace</h2>
        </div>
      </div>
    )
  }

  // Render Authenticated view
  if (isAuthenticated) {
    // Show onboarding page if user has no org.
    // Use onboardingActive (not hasCheckedOrgs) so provisioning async state
    // updates don't unmount the wizard when loadOrgs re-runs mid-flow.
    if (onboardingActive) {
      return (
        <OrgOnboarding
          timezoneOptions={TIMEZONE_OPTIONS}
          getApiAccessToken={getApiAccessToken}
          backendBaseUrl={BACKEND_BASE_URL}
          onComplete={(org) => {
            setOrgs(prev => [...prev, org])
            setSelectedOrg(org)
            setOnboardingActive(false)
          }}
          onDeleteOrg={async (org) => {
            await handleDeleteOrg(org)
            setOnboardingActive(false)
          }}
        />
      )
    }
    // Show Dashboard
    return (
      <>
        {/* Organization Creation overlay — full-screen wizard */}
        {showCreateOrg && (
          <div className="fixed inset-0 z-50">
            <OrgOnboarding
              timezoneOptions={TIMEZONE_OPTIONS}
              getApiAccessToken={getApiAccessToken}
              backendBaseUrl={BACKEND_BASE_URL}
              canClose={orgs.length > 0}
              onClose={() => setShowCreateOrg(false)}
              onComplete={(org) => {
                setOrgs(prev => [...prev, org])
                setSelectedOrg(org)
                setShowCreateOrg(false)
              }}
              onDeleteOrg={handleDeleteOrg}
            />
          </div>
        )}

        <HomePage
          selectedOrg={selectedOrg}
          orgs={orgs}
          userAvatar={userAvatar}
          userName={userName}
          userEmail={userEmail}
          onCreateOrg={() => setShowCreateOrg(true)}
          onSignOut={() => window.location.assign('/logout')}
          onSelectOrg={(org) => setSelectedOrg(org)}
          onDeleteOrg={handleDeleteOrg}
          currentUser={currentUser}
          accessToken={accessToken}
          modules={modules}
          profilePermissions={profilePermissions}
        />
      </>
    )
  }

  // Fallback (should not reach here)
  return null
}

export default App
