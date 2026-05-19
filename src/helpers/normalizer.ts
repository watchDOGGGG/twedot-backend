import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js'

export function normalizeNumber(phone: string, userCountry: CountryCode) {
  try {
    if (phone.startsWith('+')) {
      return parsePhoneNumberFromString(phone)?.number
    }

    return parsePhoneNumberFromString(phone, userCountry)?.number
  } catch {
    return null
  }
}
