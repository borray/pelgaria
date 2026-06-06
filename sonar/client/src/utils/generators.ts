export function genRegNumber(seq: number): string {
  return `ПЕЛ-${String(seq).padStart(4, '0')}`
}

export function genPassportNumber(seq: number, year: number): string {
  return `PSP-${String(seq).padStart(4, '0')}-${year}`
}

export function genCaseNumber(seq: number): string {
  return `СД-${String(seq).padStart(4, '0')}`
}

export function genLawNumber(seq: number, type: 'LAW' | 'DECREE'): string {
  const prefix = type === 'LAW' ? 'ЗАК' : 'УКЗ'
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

export function genBuildingNumber(seq: number): string {
  return `РЛК-${String(seq).padStart(4, '0')}`
}

export function genTreatyNumber(seq: number): string {
  return `ДПЛ-${String(seq).padStart(3, '0')}`
}
