import { authedFetch, BackendApiError } from './backendApi'
import type { DatasetSummary } from './dataTypes'
import { supabase } from './supabase'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const UPLOAD_ACCEPT =
  '.csv,.tsv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const DATASET_FIELDS = 'id,name,filename,columns,row_count,size_bytes,created_at'

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '')
    reader.onerror = () => reject(new BackendApiError('The file could not be read.', 0))
    reader.readAsDataURL(file)
  })
}

// The backend parses the spreadsheet (types, dates, currency) and stores it.
export async function uploadDataset(file: File): Promise<DatasetSummary> {
  if (file.size > MAX_UPLOAD_BYTES) throw new BackendApiError('Files can be up to 5 MB.', 413)
  const content = await readAsBase64(file)
  return authedFetch<DatasetSummary>('/data/datasets', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, content_base64: content }),
  })
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const { data } = await supabase.from('datasets').select(DATASET_FIELDS).order('created_at', { ascending: false })
  return (data ?? []) as unknown as DatasetSummary[]
}

export async function deleteDataset(id: string): Promise<boolean> {
  const { error } = await supabase.from('datasets').delete().eq('id', id)
  return !error
}
