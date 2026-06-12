const BASE_URL = 'https://hms.appblocks.in'

export interface Patient {
  api_id: string
  uhid?: string | null
  first_name?: string | null
  last_name?: string | null
  gender?: string | null
  date_of_birth?: string | null
  mobile?: string | null
  email?: string | null
  blood_group?: string | null
  marital_status?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  emergency_contact_name?: string | null
  emergency_contact_mobile?: string | null
  emergency_contact_relationship?: string | null
  national_id_type?: string | null
  national_id_number?: string | null
  status?: string | null
  created_time?: number | null
  modified_time?: number | null
  created_by?: string | null
  modified_by?: string | null
}

export type PatientWrite = Omit<
  Patient,
  'api_id' | 'created_time' | 'modified_time' | 'created_by' | 'modified_by'
>

const STATUS_ALIASES: Record<string, string> = {
  active: 'active',
  inactive: 'inactive',
  deceased: 'deceased',
}

function normalizePatientWrite(data: PatientWrite | Partial<PatientWrite>) {
  const payload = { ...data }
  if (payload.status != null) {
    const normalized = STATUS_ALIASES[String(payload.status).trim().toLowerCase()]
    if (normalized) payload.status = normalized
  }
  return payload
}

function headers(token: string, orgId: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Org-ID': orgId,
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export async function listPatients(
  token: string,
  orgId: string,
  params: {
    limit?: number
    offset?: number
    sortBy?: string
    sortType?: 'asc' | 'desc'
  } = {}
): Promise<Patient[]> {
  const query = new URLSearchParams()
  if (params.limit != null) query.set('limit', String(params.limit))
  if (params.offset != null) query.set('offset', String(params.offset))
  if (params.sortBy) query.set('sort_by', params.sortBy)
  if (params.sortType) query.set('sort_type', params.sortType)
  const url = `${BASE_URL}/api/patients${query.toString() ? `?${query}` : ''}`
  const res = await fetch(url, { method: 'GET', headers: headers(token, orgId) })
  return handleResponse<Patient[]>(res)
}

export async function getPatient(token: string, orgId: string, apiId: string): Promise<Patient> {
  const res = await fetch(`${BASE_URL}/api/patients/${apiId}`, {
    method: 'GET',
    headers: headers(token, orgId),
  })
  return handleResponse<Patient>(res)
}

export async function createPatient(
  token: string,
  orgId: string,
  data: PatientWrite
): Promise<Patient> {
  const res = await fetch(`${BASE_URL}/api/patients`, {
    method: 'POST',
    headers: headers(token, orgId),
    body: JSON.stringify(normalizePatientWrite(data)),
  })
  return handleResponse<Patient>(res)
}

export async function updatePatient(
  token: string,
  orgId: string,
  apiId: string,
  data: Partial<PatientWrite>
): Promise<Patient> {
  const res = await fetch(`${BASE_URL}/api/patients/${apiId}`, {
    method: 'PATCH',
    headers: headers(token, orgId),
    body: JSON.stringify(normalizePatientWrite(data)),
  })
  return handleResponse<Patient>(res)
}

export async function deletePatient(
  token: string,
  orgId: string,
  apiId: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/patients/${apiId}`, {
    method: 'DELETE',
    headers: headers(token, orgId),
  })
  return handleResponse<void>(res)
}
