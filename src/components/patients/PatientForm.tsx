import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Patient, PatientWrite } from '../../services/patientService'

const GENDER_OPTIONS = ['Male', 'Female', 'Other']
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Other']
const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Deceased', value: 'deceased' },
]
const EMERGENCY_RELATIONSHIP_OPTIONS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other']
const NATIONAL_ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving License', 'Other']

interface PatientFormProps {
  patient?: Patient | null
  onSave: (data: PatientWrite) => Promise<void>
  onClose: () => void
  organizationName: string
}

const EMPTY: PatientWrite = {
  uhid: '',
  first_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
  mobile: '',
  email: '',
  blood_group: '',
  marital_status: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  emergency_contact_name: '',
  emergency_contact_mobile: '',
  emergency_contact_relationship: '',
  national_id_type: '',
  national_id_number: '',
  status: 'active',
}

let lastUhidTimestamp = 0
let uhidSequence = 0

function normalizeStatus(value?: string | null): string {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'active' || normalized === 'inactive' || normalized === 'deceased'
    ? normalized
    : 'active'
}

function toFormValues(p: Patient): PatientWrite {
  return {
    uhid: p.uhid ?? '',
    first_name: p.first_name ?? '',
    last_name: p.last_name ?? '',
    gender: p.gender ?? '',
    date_of_birth: p.date_of_birth ?? '',
    mobile: p.mobile ?? '',
    email: p.email ?? '',
    blood_group: p.blood_group ?? '',
    marital_status: p.marital_status ?? '',
    address: p.address ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    pincode: p.pincode ?? '',
    emergency_contact_name: p.emergency_contact_name ?? '',
    emergency_contact_mobile: p.emergency_contact_mobile ?? '',
    emergency_contact_relationship: p.emergency_contact_relationship ?? '',
    national_id_type: p.national_id_type ?? '',
    national_id_number: p.national_id_number ?? '',
    status: normalizeStatus(p.status),
  }
}

function generateUHID(organizationName: string): string {
  const lettersOnly = organizationName.replace(/[^a-zA-Z]/g, '')
  const prefix = (lettersOnly.slice(0, 2).toUpperCase() || 'HM').padEnd(2, 'X')
  // TODO: Move UHID generation to backend for guaranteed uniqueness.
  const now = Date.now()
  if (now === lastUhidTimestamp) {
    uhidSequence = (uhidSequence + 1) % 100
  } else {
    lastUhidTimestamp = now
    uhidSequence = 0
  }
  const uniqueNo = (((now % 10000) * 100) + uhidSequence).toString().padStart(6, '0')
  return `${prefix}-${uniqueNo}`
}

interface FieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
}

function Field({ label, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 text-sm text-black placeholder:text-gray-400 border border-[#e2e2e2] rounded-lg bg-white focus:outline-none focus:border-[#7677f1] focus:ring-2 focus:ring-[#eeeeff] transition'
const selectCls =
  'w-full px-3 py-2 text-sm text-black border border-[#e2e2e2] rounded-lg bg-white focus:outline-none focus:border-[#7677f1] focus:ring-2 focus:ring-[#eeeeff] transition'

export default function PatientForm({ patient, onSave, onClose, organizationName }: PatientFormProps) {
  const isEdit = !!patient
  const [form, setForm] = useState<PatientWrite>(() => {
    if (patient) return toFormValues(patient)
    return { ...EMPTY, uhid: generateUHID(organizationName) }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (patient) {
      setForm(toFormValues(patient))
    } else {
      setForm({ ...EMPTY, uhid: generateUHID(organizationName) })
    }
    setError(null)
  }, [patient, organizationName])

  function set(key: keyof PatientWrite, value: string) {
    setForm(prev => ({ ...prev, [key]: value || null }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name?.trim()) {
      setError('First name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white text-black rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e2e2] shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Patient' : 'New Patient'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Personal */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required>
                <input className={inputCls} value={form.first_name ?? ''} onChange={e => set('first_name', e.target.value)} placeholder="John" />
              </Field>
              <Field label="Last Name">
                <input className={inputCls} value={form.last_name ?? ''} onChange={e => set('last_name', e.target.value)} placeholder="Doe" />
              </Field>
              <Field label="Gender">
                <select className={selectCls} value={form.gender ?? ''} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  {GENDER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Date of Birth">
                <input type="date" className={inputCls} value={form.date_of_birth ?? ''} onChange={e => set('date_of_birth', e.target.value)} />
              </Field>
              <Field label="Blood Group">
                <select className={selectCls} value={form.blood_group ?? ''} onChange={e => set('blood_group', e.target.value)}>
                  <option value="">Select</option>
                  {BLOOD_GROUP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Marital Status">
                <select className={selectCls} value={form.marital_status ?? ''} onChange={e => set('marital_status', e.target.value)}>
                  <option value="">Select</option>
                  {MARITAL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* Contact */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Contact Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mobile">
                <input className={inputCls} value={form.mobile ?? ''} onChange={e => set('mobile', e.target.value)} placeholder="+91 9876543210" />
              </Field>
              <Field label="Email">
                <input type="email" className={inputCls} value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="patient@example.com" />
              </Field>
              <Field label="Address">
                <input className={inputCls} value={form.address ?? ''} onChange={e => set('address', e.target.value)} placeholder="Street address" />
              </Field>
              <Field label="City">
                <input className={inputCls} value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="City" />
              </Field>
              <Field label="State">
                <input className={inputCls} value={form.state ?? ''} onChange={e => set('state', e.target.value)} placeholder="State" />
              </Field>
              <Field label="Pincode">
                <input className={inputCls} value={form.pincode ?? ''} onChange={e => set('pincode', e.target.value)} placeholder="560001" />
              </Field>
            </div>
          </section>

          {/* Emergency */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name">
                <input className={inputCls} value={form.emergency_contact_name ?? ''} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="Contact name" />
              </Field>
              <Field label="Mobile">
                <input className={inputCls} value={form.emergency_contact_mobile ?? ''} onChange={e => set('emergency_contact_mobile', e.target.value)} placeholder="+91 9876543210" />
              </Field>
              <Field label="Relationship">
                <select className={selectCls} value={form.emergency_contact_relationship ?? ''} onChange={e => set('emergency_contact_relationship', e.target.value)}>
                  <option value="">Select</option>
                  {EMERGENCY_RELATIONSHIP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* ID & Status */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">ID &amp; Status</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="UHID">
                <input
                  className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`}
                  value={form.uhid ?? ''}
                  readOnly
                  disabled
                  placeholder="Hospital ID"
                />
              </Field>
              <Field label="Status">
                <select className={selectCls} value={form.status ?? ''} onChange={e => set('status', e.target.value)}>
                  <option value="">Select</option>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="National ID Type">
                <select className={selectCls} value={form.national_id_type ?? ''} onChange={e => set('national_id_type', e.target.value)}>
                  <option value="">Select</option>
                  {NATIONAL_ID_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="National ID Number">
                <input className={inputCls} value={form.national_id_number ?? ''} onChange={e => set('national_id_number', e.target.value)} placeholder="ID number" />
              </Field>
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e2e2] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-[#7677f1] text-white rounded-lg hover:bg-[#6566e0] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Patient'}
          </button>
        </div>
      </div>
    </div>
  )
}
