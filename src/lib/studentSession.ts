const STORAGE_KEY = 'benebloc_student_email'

export function getStudentEmail(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStudentEmail(email: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, email)
  } catch { /* ignore */ }
}

export function clearStudentEmail(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
