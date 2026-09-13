import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import type { Tables } from './database.types'
import { supabase } from './supabase'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data)
        setLoading(false)
      })
  }, [user])

  return { profile, loading, setProfile }
}
