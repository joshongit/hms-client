import { useState, useEffect, useRef } from 'react'
import { Check, ArrowRight, ArrowLeft, Tag, Info, Loader2 } from 'lucide-react'

interface Org {
  org_id: string | number
  org_name: string
  timezone: string
}

interface OrgOnboardingProps {
  timezoneOptions: Array<{ value: string; label: string }>
  getApiAccessToken: () => Promise<string>
  backendBaseUrl: string
  onComplete: (org: Org) => void
  onDeleteOrg?: (org: Org) => Promise<void>
}

type OnboardingStep = 'org-setup' | 'creating-org' | 'provisioning' | 'institution-details' | 'compliance'

const HOSPITAL_TYPES = [
  'Government',
  'Private Trust',
  'Private Corporate',
  'Teaching Hospital',
  'Specialty Clinic',
  'Nursing Home',
]

const ACCREDITATION_OPTIONS = ['NABH', 'JCI', 'ISO 9001', 'NABL', 'NABH-SHCO']

const MODULE_API_NAME = 'org_settings'
const LAYOUT_API_NAME = 'org_settings_default'

const LOCAL_STORAGE_STEP_KEY = 'hms_onboarding_step_v1'
const LOCAL_STORAGE_ORG_KEY = 'hms_onboarding_created_org_v1'
const HMS_STEP_CHANGE_EVENT = 'hms_onboarding_step_change'
const VALID_STEPS: OnboardingStep[] = ['org-setup', 'creating-org', 'provisioning', 'institution-details', 'compliance']

const readStoredStep = (): OnboardingStep | null => {
  const stored = localStorage.getItem(LOCAL_STORAGE_STEP_KEY)
  if (stored && VALID_STEPS.includes(stored as OnboardingStep)) {
    return stored as OnboardingStep
  }
  return null
}

const readStoredOrg = (): Org | null => {
  const saved = localStorage.getItem(LOCAL_STORAGE_ORG_KEY)
  try {
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export default function OrgOnboarding({
  timezoneOptions,
  getApiAccessToken,
  backendBaseUrl,
  onComplete,
}: OrgOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>(() => {
    return readStoredStep() ?? 'org-setup'
  })
  const [error, setError] = useState<string | null>(null)
  const [provisioningStatus, setProvisioningStatus] = useState<string>('')

  // Page 1 state
  const [orgName, setOrgName] = useState('')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [isCreating, setIsCreating] = useState(false)

  // Created org (set after page 1)
  const [createdOrg, setCreatedOrg] = useState<Org | null>(() => readStoredOrg())

  // Guard: prevent double-provisioning in React StrictMode double-invoke.
  // useRef persists across StrictMode simulated unmount/remount; useState does not.
  const provisioningStartedRef = useRef(false)

  const updateStep = (newStep: OnboardingStep) => {
    console.log(`💾 Saving step to localStorage: ${newStep}`)
    localStorage.setItem(LOCAL_STORAGE_STEP_KEY, newStep)
    setStep(newStep)
    // Dispatch a window event so the currently-mounted instance always picks up
    // the new step even if this call comes from a stale async closure.
    window.dispatchEvent(new CustomEvent(HMS_STEP_CHANGE_EVENT, { detail: newStep }))
  }

  // Render should follow persisted step so stale async state closures cannot
  // keep the UI on an old screen.
  const effectiveStep = readStoredStep() ?? step
  const effectiveCreatedOrg = createdOrg ?? readStoredOrg()

  const updateCreatedOrg = (org: Org | null) => {
    if (org) {
      console.log(`💾 Saving createdOrg to localStorage:`, org)
      localStorage.setItem(LOCAL_STORAGE_ORG_KEY, JSON.stringify(org))
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ORG_KEY)
    }
    setCreatedOrg(org)
  }

  const resetOnboardingState = () => {
    provisioningStartedRef.current = false
    setError(null)
    setProvisioningStatus('')
    updateCreatedOrg(null)
    updateStep('org-setup')
  }

  // Listen for step changes dispatched by any (possibly stale) async callback.
  // This ensures the currently-mounted instance always renders the right page.
  useEffect(() => {
    const handler = (e: Event) => {
      const newStep = (e as CustomEvent<OnboardingStep>).detail
      console.log(`📡 Received step change event: ${newStep}`)
      if (newStep && VALID_STEPS.includes(newStep)) {
        setStep(newStep)
      }
    }
    window.addEventListener(HMS_STEP_CHANGE_EVENT, handler)
    return () => window.removeEventListener(HMS_STEP_CHANGE_EVENT, handler)
  }, [])

  // Auto-resume provisioning if mounted/remounted while step is 'provisioning'.
  // The ref guard prevents double-execution in React StrictMode (refs survive
  // StrictMode's simulated unmount/remount, unlike state).
  useEffect(() => {
    if (effectiveStep === 'provisioning' && effectiveCreatedOrg && !provisioningStartedRef.current) {
      provisioningStartedRef.current = true
      console.log('🔄 Component mounted in provisioning step. Starting provisioning (guarded)...')
      getApiAccessToken().then((token) => {
        console.log('✅ Generated token for auto-run provisioning')
        runProvisioning(effectiveCreatedOrg, token)
      }).catch(err => {
        console.error('❌ Failed to get token for auto-provisioning:', err)
        setError(`Provisioning failed: ${err instanceof Error ? err.message : String(err)}`)
      })
    }
  }, []) // run once on mount

  // Page 2 state
  const [officialName, setOfficialName] = useState('')
  const [hospitalType, setHospitalType] = useState('')
  const [physicalAddress, setPhysicalAddress] = useState('')
  const [primaryContactName, setPrimaryContactName] = useState('')
  const [contactNumber, setContactNumber] = useState('')

  // Page 3 state
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [taxId, setTaxId] = useState('')
  const [accreditations, setAccreditations] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const makeHeaders = (token: string, orgId?: string | number) => {
    const h: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (orgId !== undefined) h['X-Org-ID'] = String(orgId)
    return h
  }

  /** POST with 409-as-success semantics */
  const postIdempotent = async (url: string, body: unknown, token: string, orgId: string | number) => {
    console.log(`📤 POST ${url}`, body)
    const res = await fetch(url, {
      method: 'POST',
      headers: makeHeaders(token, orgId),
      body: JSON.stringify(body),
    })
    console.log(`📥 Response status: ${res.status}`)
    if (res.status === 409) {
      console.log('ℹ️   409 Conflict (already exists) - treating as success')
      return
    }
    if (!res.ok) {
      const resText = await res.text()
      console.error(`❌ API error: ${res.status} ${res.statusText}`)
      console.error(`Response body:`, resText)
      throw new Error(`${res.status} ${res.statusText} at ${url}`)
    }
    console.log('✅ API call succeeded')
  }

  // ─── Page 1: Create Org ───────────────────────────────────────────────────

  const handleCreateOrg = async () => {
    if (isCreating) return
    if (!orgName.trim()) {
      setError('Hospital name is required')
      return
    }
    console.log('🟢 Starting org creation with name:', orgName, 'timezone:', timezone)
    setIsCreating(true)
    setError(null)
    updateStep('creating-org')
    try {
      const token = await getApiAccessToken()
      console.log('✅ Got access token')
      const res = await fetch(`${backendBaseUrl}/api/orgs`, {
        method: 'POST',
        headers: makeHeaders(token),
        body: JSON.stringify({ org_name: orgName.trim(), timezone }),
      })
      console.log('📥 Org creation response status:', res.status)
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const org: Org = await res.json()
      console.log('✅ Org created:', org)
      updateCreatedOrg(org)
      console.log('📍 Setting step to provisioning...')
      updateStep('provisioning')
      console.log('📍 Calling runProvisioning...')
      runProvisioning(org, token)
    } catch (err) {
      console.error('❌ Org creation failed:', err)
      updateStep('org-setup')
      setError('Failed to create organization. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  // ─── Provisioning ─────────────────────────────────────────────────────────

  const runProvisioning = async (org: Org, token: string) => {
    console.log('🔵 runProvisioning started for org:', org)
    setError(null)
    try {
      setProvisioningStatus('Creating org settings module…')
      console.log('📍 Step 1: Creating module...')
      await postIdempotent(
        `${backendBaseUrl}/api/modules`,
        { name: 'Org Settings', module_api_name: MODULE_API_NAME },
        token,
        org.org_id,
      )
      console.log('✅ Module created successfully')

      const fields: Array<{ label_name: string; api_name: string; data_type: string; options?: Array<{ value: string; sort_order: number }> }> = [
        { label_name: 'Official Name', api_name: 'official_name', data_type: 'text' },
        {
          label_name: 'Hospital Type',
          api_name: 'hospital_type',
          data_type: 'drop_down',
          options: HOSPITAL_TYPES.map((v, i) => ({ value: v, sort_order: i + 1 })),
        },
        { label_name: 'Physical Address', api_name: 'physical_address', data_type: 'long_text' },
        { label_name: 'Primary Contact Name', api_name: 'primary_contact_name', data_type: 'text' },
        { label_name: 'Contact Number', api_name: 'contact_number', data_type: 'text' },
        { label_name: 'Registration Number', api_name: 'registration_number', data_type: 'text' },
        { label_name: 'Tax ID / GSTIN', api_name: 'tax_id', data_type: 'text' },
        {
          label_name: 'Accreditations',
          api_name: 'accreditations',
          data_type: 'multi_select',
          options: ACCREDITATION_OPTIONS.map((v, i) => ({ value: v, sort_order: i + 1 })),
        },
      ]

      for (const field of fields) {
        setProvisioningStatus(`Creating field: ${field.label_name}…`)
        console.log(`📍 Creating field: ${field.label_name}`)
        await postIdempotent(
          `${backendBaseUrl}/api/fields`,
          { module_api_name: MODULE_API_NAME, ...field },
          token,
          org.org_id,
        )
        console.log(`✅ Field created: ${field.label_name}`)
      }

      console.log('📍 All fields created. Now creating layout...')

      setProvisioningStatus('Creating layout…')
      console.log('📍 Step 2: Creating layout...')
      await postIdempotent(
        `${backendBaseUrl}/api/layouts/${MODULE_API_NAME}`,
        {
          layout_api_name: LAYOUT_API_NAME,
          display_label: 'Org Settings Default',
          is_active: true,
          sections: [
            {
              type: 'form',
              display_label: 'Institution Details',
              sort_order: 1,
              columns: 2,
              fields: [
                { api_name: 'official_name', sort_order: 1, is_mandatory: true },
                { api_name: 'hospital_type', sort_order: 2 },
                { api_name: 'physical_address', sort_order: 3 },
                { api_name: 'primary_contact_name', sort_order: 4 },
                { api_name: 'contact_number', sort_order: 5 },
              ],
            },
            {
              type: 'form',
              display_label: 'Compliance',
              sort_order: 2,
              columns: 2,
              fields: [
                { api_name: 'registration_number', sort_order: 1 },
                { api_name: 'tax_id', sort_order: 2 },
                { api_name: 'accreditations', sort_order: 3 },
              ],
            },
          ],
        },
        token,
        org.org_id,
      )
      console.log('✅ Layout created successfully')

      setProvisioningStatus('')
      console.log('📍 Clearing provisioning status...')
      console.log('🟢 About to navigate to institution-details step')
      updateStep('institution-details')
      console.log('🟢 Navigation triggered to institution-details')
    } catch (err) {
      setProvisioningStatus('')
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('❌ Provisioning failed with error:', err)
      console.error('❌ Error message:', errorMsg)
      setError(`Provisioning failed: ${errorMsg}`)
    }
  }

  const handleRetryProvisioning = async () => {
    if (!effectiveCreatedOrg) {
      setError('No organization found. Please start setup again.')
      resetOnboardingState()
      return
    }
    console.log('🔄 Retrying provisioning...')
    setError(null)
    updateStep('provisioning')
    try {
      const token = await getApiAccessToken()
      console.log('✅ Got access token for retry')
      runProvisioning(effectiveCreatedOrg, token)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('❌ Failed to get token for retry:', err)
      setError(`Provisioning failed: ${errorMsg}`)
    }
  }

  // ─── Page 3: Final Save ───────────────────────────────────────────────────

  const handleSaveAndFinish = async () => {
    const org = effectiveCreatedOrg
    if (!org) {
      setError('No organization found. Please start setup again.')
      resetOnboardingState()
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const token = await getApiAccessToken()
      const payload: Record<string, unknown> = {}
      if (officialName.trim()) payload.official_name = officialName.trim()
      if (hospitalType) payload.hospital_type = hospitalType
      if (physicalAddress.trim()) payload.physical_address = physicalAddress.trim()
      if (primaryContactName.trim()) payload.primary_contact_name = primaryContactName.trim()
      if (contactNumber.trim()) payload.contact_number = contactNumber.trim()
      if (registrationNumber.trim()) payload.registration_number = registrationNumber.trim()
      if (taxId.trim()) payload.tax_id = taxId.trim()
      if (accreditations.length > 0) payload.accreditations = accreditations

      const res = await fetch(`${backendBaseUrl}/api/${MODULE_API_NAME}`, {
        method: 'POST',
        headers: makeHeaders(token, org.org_id),
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      localStorage.removeItem(LOCAL_STORAGE_STEP_KEY)
      localStorage.removeItem(LOCAL_STORAGE_ORG_KEY)
      setCreatedOrg(null)
      onComplete(org)
    } catch (err) {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSkipAndFinish = () => {
    if (effectiveCreatedOrg) {
      localStorage.removeItem(LOCAL_STORAGE_STEP_KEY)
      localStorage.removeItem(LOCAL_STORAGE_ORG_KEY)
      setCreatedOrg(null)
      onComplete(effectiveCreatedOrg)
      return
    }
    setError('No organization found. Please start setup again.')
    resetOnboardingState()
  }

  // ─── Sidebar steps ────────────────────────────────────────────────────────

  const sidebarSteps = [
    {
      title: 'Workspace Setup',
      description: 'Set up your hospital name and timezone to initialize your organization.',
    },
    {
      title: 'Institution Details',
      description: 'Add your registered name, hospital type, address and primary contact.',
    },
    {
      title: 'Compliance Info',
      description: 'Provide registration number, tax ID and accreditations for compliance.',
    },
    {
      title: 'All Done',
      description: 'Your organization is ready. You can update these settings anytime.',
    },
  ]

  const stepIndex: Record<OnboardingStep, number> = {
    'org-setup': 0,
    'creating-org': 0,
    'provisioning': 0,
    'institution-details': 1,
    'compliance': 2,
  }
  const currentIdx = stepIndex[effectiveStep]

  const getStepState = (idx: number) => {
    if (idx < currentIdx) return 'completed'
    if (idx === currentIdx) return 'active'
    return 'pending'
  }

  // ─── DNA Loader ────────────────────────────────────────────────────────────

  const DNALoader = () => {
    const n = 9
    const dur = 1.8
    const pink = ['#fda4af', '#fb7185', '#e879f9', '#d946ef', '#f472b6']
    const blue = ['#c7d2fe', '#93c5fd', '#818cf8', '#6366f1', '#8b5cf6']
    const base = 13
    return (
      <div style={{ position: 'relative', width: '250px', height: '72px', margin: '0 auto' }}>
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
        {Array.from({ length: n }, (_, i) => {
          const x = 12 + (i / (n - 1)) * 226
          const delay = `${-(i / n) * dur}s`
          const ci = i % blue.length
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: x - base / 2, top: '50%', marginTop: -base / 2,
                width: base, height: base, borderRadius: '50%',
                background: blue[ci],
                animation: `dna-s2 ${dur}s ease-in-out infinite`,
                animationDelay: delay,
              }}
            />
          )
        })}
        {Array.from({ length: n }, (_, i) => {
          const x = 12 + (i / (n - 1)) * 226
          const delay = `${-(i / n) * dur}s`
          const ci = i % pink.length
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: x - base / 2, top: '50%', marginTop: -base / 2,
                width: base, height: base, borderRadius: '50%',
                background: pink[ci],
                animation: `dna-s1 ${dur}s ease-in-out infinite`,
                animationDelay: delay,
              }}
            />
          )
        })}
      </div>
    )
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────

  const Sidebar = () => (
    <div
      className="hidden md:flex w-[380px] flex-col justify-between p-10 relative overflow-hidden shrink-0"
      style={{ background: 'linear-gradient(160deg, #fdf0ff 0%, #f5e6fd 50%, #ede0fa 100%)' }}
    >
      <div>
        <div className="flex items-start gap-2 mb-10 text-sm text-gray-700">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-pink-400" />
          <span>Set up your healthcare organization in a few simple steps.</span>
        </div>

        <div className="space-y-0">
          {sidebarSteps.map((s, idx) => {
            const state = getStepState(idx)
            return (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      state === 'completed'
                        ? 'bg-pink-500 text-white shadow-md shadow-pink-200'
                        : state === 'active'
                        ? 'bg-white border-2 border-pink-400 text-pink-400 shadow-sm'
                        : 'bg-white border-2 border-gray-200 text-gray-300'
                    }`}
                  >
                    {state === 'completed' ? (
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    ) : (
                      <Tag className={`w-4 h-4 ${state === 'active' ? 'text-pink-400' : 'text-gray-300'}`} />
                    )}
                  </div>
                  {idx < sidebarSteps.length - 1 && (
                    <div
                      className="w-0.5 my-1 transition-colors"
                      style={{
                        height: '52px',
                        background: state === 'completed' ? '#f9a8d4' : '#e5e7eb',
                      }}
                    />
                  )}
                </div>
                <div className="pb-6">
                  <h4 className="font-bold text-sm text-gray-900">
                    {s.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{s.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Decorative hexagon pattern */}
      <div className="absolute bottom-0 left-0 right-0 h-48 opacity-20 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {[
            [60, 160], [120, 130], [180, 160], [240, 130], [300, 160], [360, 130],
            [30, 200], [90, 170], [150, 200], [210, 170], [270, 200], [330, 170],
          ].map(([cx, cy], i) => (
            <polygon
              key={i}
              points={`${cx},${cy - 28} ${cx + 24},${cy - 14} ${cx + 24},${cy + 14} ${cx},${cy + 28} ${cx - 24},${cy + 14} ${cx - 24},${cy - 14}`}
              fill="none"
              stroke="#d946ef"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
    </div>
  )

  // ─── Shared error banner ───────────────────────────────────────────────────

  const ErrorBanner = () =>
    error ? (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start justify-between gap-2">
        <span>{error}</span>
        <button onClick={() => setError(null)} className="font-bold shrink-0 hover:text-red-800">✕</button>
      </div>
    ) : null

  // ─── Page 1: Workspace Setup ───────────────────────────────────────────────

  if (effectiveStep === 'org-setup' || effectiveStep === 'creating-org') {
    return (
      <div className="min-h-screen flex bg-white text-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 max-w-2xl w-full mx-auto">
            {effectiveStep === 'creating-org' ? (
              <div className="max-w-md w-full mx-auto space-y-6 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pink-100 bg-pink-50 text-xs font-semibold uppercase tracking-[0.2em] text-pink-500">
                  Step 1 of 3
                </div>
                <div className="space-y-4">
                  <DNALoader />
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">Creating Your Organization</h1>
                    <p className="text-gray-500 leading-relaxed">
                      We are creating your organization first. The workspace setup will begin automatically right after this step.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-bold text-pink-500 uppercase tracking-widest mb-3">STEP 1 OF 3</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Create Your Organization</h1>
                <p className="text-gray-500 leading-relaxed mb-8">
                  Start by giving your hospital a name and selecting its timezone. This sets up your organization workspace.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleCreateOrg()
                  }}
                  className="space-y-6"
                >
                  <ErrorBanner />

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Hospital Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City General Hospital"
                      value={orgName}
                      onChange={(e) => { setOrgName(e.target.value); setError(null) }}
                      disabled={isCreating}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">This will be your organization's display name</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Time Zone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      disabled={isCreating}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition disabled:opacity-50"
                    >
                      {timezoneOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1.5">Select your primary operating timezone</p>
                  </div>

                  {!orgName.trim() && (
                    <div>
                      <p className="text-sm font-semibold text-gray-500 mb-3">Suggestions</p>
                      <div className="flex flex-wrap gap-2">
                        {['City Hospital', 'Wellness Clinic', 'Care Center'].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setOrgName(suggestion)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-600 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 transition"
                          >
                            <span className="text-gray-400">+</span> {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>

          <div className="border-t border-gray-100 px-8 md:px-16 py-5 flex items-center justify-end">
            <button
              type="button"
              disabled={effectiveStep === 'creating-org' || !orgName.trim()}
              onClick={handleCreateOrg}
              className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md shadow-pink-100"
            >
              {effectiveStep === 'creating-org' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
              ) : (
                <>Process & Setup <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Provisioning screen ───────────────────────────────────────────────────

  if (effectiveStep === 'provisioning') {
    console.log('🎨 Rendering provisioning screen. Error state:', error)
    return (
      <div className="min-h-screen flex bg-white text-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 gap-8">
          {error ? (
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Provisioning Failed</h2>
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 text-left">{error}</p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleRetryProvisioning}
                  className="flex items-center gap-2 mx-auto px-7 py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-pink-100"
                >
                  Retry Setup
                </button>
                <button
                  onClick={() => { setError(null); updateStep('institution-details') }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
                >
                  Continue to Setup <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-md w-full space-y-8 text-center">
              <DNALoader />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {isCreating ? 'Creating Your Organization' : 'Setting Up Your Workspace'}
                </h2>
                <p className="text-gray-500 text-sm">
                  {isCreating
                    ? "We're creating your organization and preparing the workspace. This only takes a moment."
                    : "We're configuring your organization's data schema. This only takes a moment."}
                </p>
              </div>
              {(provisioningStatus || isCreating) && (
                <div className="flex items-center justify-center gap-2 text-sm text-pink-500 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {provisioningStatus || 'Creating organization…'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Page 2: Institution Details ───────────────────────────────────────────

  if (effectiveStep === 'institution-details') {
    console.log('🎨 Rendering institution-details screen')
    return (
      <div className="h-screen flex bg-white text-gray-900 overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 md:px-16 py-12">
            <div className="max-w-2xl w-full mx-auto min-h-full flex flex-col justify-center">
              <p className="text-sm font-bold text-pink-500 uppercase tracking-widest mb-3">STEP 2 OF 3</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Institution Details</h1>
              <p className="text-gray-500 leading-relaxed mb-8">
                Provide your institution's official details. You can skip this and fill it in later from settings.
              </p>

              <div className="space-y-5 pb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Official Registered Name</label>
                  <input
                    type="text"
                    placeholder="Legal name of the medical institution"
                    value={officialName}
                    onChange={(e) => setOfficialName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hospital Type</label>
                  <select
                    value={hospitalType}
                    onChange={(e) => setHospitalType(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition"
                  >
                    <option value="">Select hospital type</option>
                    {HOSPITAL_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Physical Address</label>
                  <textarea
                    rows={3}
                    placeholder="Full street address of the facility"
                    value={physicalAddress}
                    onChange={(e) => setPhysicalAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Contact Name</label>
                  <input
                    type="text"
                    placeholder="Name of the primary contact"
                    value={primaryContactName}
                    onChange={(e) => setPrimaryContactName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                  <input
                    type="tel"
                    placeholder="Primary contact phone number"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 px-8 md:px-16 py-5 flex items-center justify-between bg-white">
            <button
              type="button"
              onClick={() => updateStep('compliance')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
            >
              Skip & Continue <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => updateStep('compliance')}
              className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 text-white font-semibold rounded-xl transition text-sm shadow-md shadow-pink-100"
            >
              Save & Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Page 3: Compliance ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex bg-white text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 max-w-2xl w-full mx-auto">
          <p className="text-sm font-bold text-pink-500 uppercase tracking-widest mb-3">STEP 3 OF 3</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Compliance & Accreditations</h1>
          <p className="text-gray-500 leading-relaxed mb-8">
            Add your registration and compliance details. You can skip and update these later in settings.
          </p>

          <div className="space-y-5">
            <ErrorBanner />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Registration Number</label>
              <input
                type="text"
                placeholder="Government or statutory registration number"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                disabled={isSaving}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tax ID / GSTIN</label>
              <input
                type="text"
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                disabled={isSaving}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-sm transition disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Accreditations</label>
              <div className="flex flex-wrap gap-3">
                {ACCREDITATION_OPTIONS.map((acc) => {
                  const checked = accreditations.includes(acc)
                  return (
                    <button
                      key={acc}
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        setAccreditations((prev) =>
                          checked ? prev.filter((a) => a !== acc) : [...prev, acc],
                        )
                      }
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition disabled:opacity-50 ${
                        checked
                          ? 'bg-pink-500 border-pink-500 text-white shadow-sm shadow-pink-100'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      {acc}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">Select all that apply</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 md:px-16 py-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => updateStep('institution-details')}
            disabled={isSaving}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSkipAndFinish}
              disabled={isSaving}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition disabled:opacity-50"
            >
              Skip & Continue <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSaveAndFinish}
              disabled={isSaving}
              className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md shadow-pink-100"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <>Save & Finish <Check className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
