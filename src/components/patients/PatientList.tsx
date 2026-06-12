import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, MoreHorizontal, X } from 'lucide-react'
import {
  listPatients,
  createPatient,
  updatePatient,
  deletePatient,
  type Patient,
  type PatientWrite,
} from '../../services/patientService'
import PatientForm from './PatientForm'

const PAGE_SIZE = 20
const PATIENT_SORT_BY = 'created_time'
type PatientSortType = 'asc' | 'desc'

interface PatientListProps {
  accessToken: string
  orgId: string
  organizationName: string
  openCreateSignal?: number
}

function Badge({ status }: { status?: string | null }) {
  const normalized = status?.toLowerCase() ?? ''
  const color =
    normalized === 'active'
      ? 'bg-green-100 text-green-700'
      : normalized === 'inactive'
      ? 'bg-gray-100 text-gray-500'
      : normalized === 'deceased'
      ? 'bg-red-100 text-red-600'
      : 'bg-gray-100 text-gray-400'

  const label =
    normalized === 'active'
      ? 'Active'
      : normalized === 'inactive'
      ? 'Inactive'
      : normalized === 'deceased'
      ? 'Deceased'
      : (status ?? '—')

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  )
}

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-lg border border-[#ececf4] bg-[#fbfbff] px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 break-words">{value ?? '—'}</p>
    </div>
  )
}

function formatEpoch(value?: number | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export default function PatientList({
  accessToken,
  orgId,
  organizationName,
  openCreateSignal = 0,
}: PatientListProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [sortType, setSortType] = useState<PatientSortType>('desc')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPatients = useCallback(async (off: number) => {
    if (!accessToken || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listPatients(accessToken, orgId, {
        limit: PAGE_SIZE,
        offset: off,
        sortBy: PATIENT_SORT_BY,
        sortType,
      })
      setPatients(data)
      setHasMore(data.length === PAGE_SIZE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients.')
    } finally {
      setLoading(false)
    }
  }, [accessToken, orgId, sortType])

  useEffect(() => {
    setOffset(0)
    fetchPatients(0)
  }, [fetchPatients])

  useEffect(() => {
    if (!menuOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  useEffect(() => {
    if (openCreateSignal > 0) {
      setEditing(null)
      setFormOpen(true)
    }
  }, [openCreateSignal])

  function handlePrev() {
    const next = Math.max(0, offset - PAGE_SIZE)
    setOffset(next)
    fetchPatients(next)
  }

  function handleNext() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchPatients(next)
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(p: Patient) {
    setEditing(p)
    setFormOpen(true)
  }

  function handleSortChange(nextSort: PatientSortType) {
    setSortType(nextSort)
    setOffset(0)
    setMenuOpen(false)
  }

  async function handleSave(data: PatientWrite) {
    if (editing) {
      const updated = await updatePatient(accessToken, orgId, editing.api_id, data)
      setPatients(prev => prev.map(p => (p.api_id === updated.api_id ? updated : p)))
    } else {
      await createPatient(accessToken, orgId, data)
      await fetchPatients(offset)
    }
    setFormOpen(false)
    setEditing(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePatient(accessToken, orgId, deleteTarget.api_id)
      setPatients(prev => prev.filter(p => p.api_id !== deleteTarget.api_id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="mx-6 mt-4 rounded-2xl border border-[#e2e2e2] bg-[#faf9ff] px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Patients</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage patient records</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[0.6rem] border border-[#d8d8d8] bg-white px-2 py-1">
            <span className="px-1 text-xs font-medium text-gray-500">Page {page}</span>
            <button
              type="button"
              onClick={handlePrev}
              disabled={offset === 0 || loading}
              aria-label="Go to previous page"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#eeeeff] disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasMore || loading}
              aria-label="Go to next page"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#eeeeff] disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#7677f1] text-white rounded-lg hover:bg-[#6566e0] transition"
          >
            <Plus className="w-4 h-4" />
            Add Patient
          </button>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              className="flex items-center justify-center h-9 w-11 rounded-xl border border-[#d8d8d8] bg-white text-[#7677f1] hover:bg-[#f7f7ff] focus:outline-none focus:ring-2 focus:ring-[#eeeeff] transition"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-[#e2e2e2] bg-white shadow-md overflow-hidden">
                <div className="px-4 pt-4 pb-2.5">
                  <p className="text-xs font-bold tracking-[0.14em] text-gray-500 uppercase mb-2.5">Sort By</p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleSortChange('desc')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-base transition ${
                        sortType === 'desc'
                          ? 'bg-[#f3f4ff] text-[#4f57d9] font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Newest First
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSortChange('asc')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-base transition ${
                        sortType === 'asc'
                          ? 'bg-[#f3f4ff] text-[#4f57d9] font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Oldest First
                    </button>
                  </div>
                </div>
                <div className="border-t border-[#ececec] p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      fetchPatients(offset)
                    }}
                    disabled={loading}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#f4f5f8] text-gray-700 hover:bg-[#eceef4] focus:outline-none focus:ring-2 focus:ring-[#eeeeff] transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-medium">Refresh List</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading && patients.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : patients.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-base font-semibold">No patients found</p>
            <p className="text-sm mt-1">Click "Add Patient" to register the first patient.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#e2e2e2]">
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">UHID</th>
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Name</th>
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Gender</th>
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">DOB</th>
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Mobile</th>
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Email</th>
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="py-3 px-3" />
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr
                  key={p.api_id}
                  className="border-b border-[#f0f0f0] hover:bg-[#faf9ff] transition group cursor-pointer"
                  onClick={() => setSelectedPatient(p)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedPatient(p)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="py-3 px-3 text-gray-500 font-mono text-xs">{p.uhid ?? '—'}</td>
                  <td className="py-3 px-3 font-medium text-gray-900">
                    {[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="py-3 px-3 text-gray-600">{p.gender ?? '—'}</td>
                  <td className="py-3 px-3 text-gray-600">{p.date_of_birth ?? '—'}</td>
                  <td className="py-3 px-3 text-gray-600">{p.mobile ?? '—'}</td>
                  <td className="py-3 px-3 text-gray-500 max-w-[160px] truncate">{p.email ?? '—'}</td>
                  <td className="py-3 px-3"><Badge status={p.status} /></td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          openEdit(p)
                        }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-[#7677f1] hover:bg-[#eeeeff] transition"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setDeleteTarget(p)
                        }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit form modal */}
      {formOpen && (
        <PatientForm
          patient={editing}
          onSave={handleSave}
          organizationName={organizationName}
          onClose={() => { setFormOpen(false); setEditing(null) }}
        />
      )}

      {/* Patient details sheet */}
      {selectedPatient && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedPatient(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl border-l border-[#e6e6ef] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-[#ececf4]">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Patient Details</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {[selectedPatient.first_name, selectedPatient.last_name].filter(Boolean).join(' ') || selectedPatient.uhid || selectedPatient.api_id}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null)
                    openEdit(selectedPatient)
                  }}
                  className="p-2 rounded-lg text-[#7677f1] hover:bg-[#eeeeff] transition"
                  title="Edit patient"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
                  aria-label="Close patient details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <DetailItem label="UHID" value={selectedPatient.uhid} />
                <DetailItem label="Status" value={selectedPatient.status} />
                <DetailItem label="First Name" value={selectedPatient.first_name} />
                <DetailItem label="Last Name" value={selectedPatient.last_name} />
                <DetailItem label="Gender" value={selectedPatient.gender} />
                <DetailItem label="Date of Birth" value={selectedPatient.date_of_birth} />
                <DetailItem label="Mobile" value={selectedPatient.mobile} />
                <DetailItem label="Email" value={selectedPatient.email} />
                <DetailItem label="Blood Group" value={selectedPatient.blood_group} />
                <DetailItem label="Marital Status" value={selectedPatient.marital_status} />
                <DetailItem label="Address" value={selectedPatient.address} />
                <DetailItem label="City" value={selectedPatient.city} />
                <DetailItem label="State" value={selectedPatient.state} />
                <DetailItem label="Pincode" value={selectedPatient.pincode} />
                <DetailItem label="Emergency Name" value={selectedPatient.emergency_contact_name} />
                <DetailItem label="Emergency Mobile" value={selectedPatient.emergency_contact_mobile} />
                <DetailItem label="Emergency Relationship" value={selectedPatient.emergency_contact_relationship} />
                <DetailItem label="National ID Type" value={selectedPatient.national_id_type} />
                <DetailItem label="National ID Number" value={selectedPatient.national_id_number} />
                <DetailItem label="Created Time" value={formatEpoch(selectedPatient.created_time)} />
                <DetailItem label="Modified Time" value={formatEpoch(selectedPatient.modified_time)} />
                <div className="rounded-lg border border-[#ececf4] bg-[#fbfbff] px-3 py-2">
                  <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Created By</p>
                  <p className="mt-1 text-xs font-mono text-gray-600 break-all">{selectedPatient.created_by ?? '—'}</p>
                </div>
                <div className="rounded-lg border border-[#ececf4] bg-[#fbfbff] px-3 py-2">
                  <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Modified By</p>
                  <p className="mt-1 text-xs font-mono text-gray-600 break-all">{selectedPatient.modified_by ?? '—'}</p>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Delete Patient</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{' '}
              <span className="font-semibold">
                {[deleteTarget.first_name, deleteTarget.last_name].filter(Boolean).join(' ') || deleteTarget.uhid || deleteTarget.api_id}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
