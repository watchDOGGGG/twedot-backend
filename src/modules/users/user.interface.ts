// modules/users/user.interface.ts
export interface USER_MODEL {
  id: string
  phone_number: string
  country_code: string
  name: string | null
  occupation: string | null
  profile_photo_url: string | null
  is_verified: boolean
  country: string | null
  state: string | null
  city: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  public_key: string | null
  created_at: Date
  updated_at: Date
}

export interface RegisterPayload {
  phone_number: string
  country_code: string
}

export interface VerifyOtpPayload {
  phone_number: string
  otp: string
  device_id: string
}

export interface CompleteProfilePayload {
  userId: string
  name: string
  occupation: string
  city: string
  country: string
  latitude: number
  longitude: number
  profile_photo_url?: string
}

export interface ResendOtpPayload {
  phone_number: string
}

export interface BlockedUserRecord {
  id: string
  name: string | null
  phone_number: string
  profile_photo_url: string | null
  occupation: string | null
  blocked_at: Date
}

export interface UpdateProfilePayload {
  userId: string
  name?: string
  occupation?: string
  profile_photo_url?: string
  city?: string
  country?: string
  website?: string
  latitude?: number
  longitude?: number
}

export interface SearchUsersPayload {
  occupation: string
  latitude: number
  longitude: number
}

export interface DeviceInfo {
  id: string
  device_id: string
  user_id: string
  fcm_token: string | null
  created_at: Date
  updated_at: Date
}

export interface AuthenticationToken {
  id: string
  user_id: string
  token: string
  expires: Date
  created_at: Date
  updated_at: Date
}
