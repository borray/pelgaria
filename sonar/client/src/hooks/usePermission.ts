import { useAuthStore } from '../store/auth'

export function usePermission(perm: string): boolean {
  return useAuthStore((state) => state.hasPermission(perm))
}
