/**
 * Phone number validation utility using libphonenumber-js
 * Industry-standard phone number validation for international numbers
 */

import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

/**
 * Format and validate a phone number using libphonenumber-js
 * @param phone - Raw phone number string
 * @param defaultCountry - Default country code (default: 'IN' for India)
 * @returns Formatted E.164 phone number or null if invalid
 */
export function formatPhoneNumber(
    phone: string,
    defaultCountry: CountryCode = 'IN'
): string | null {
    if (!phone || typeof phone !== 'string') {
        return null;
    }

    try {
        // Parse the phone number with default country
        const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
        
        // Check if the number is valid
        if (!phoneNumber || !phoneNumber.isValid()) {
            return null;
        }

        // Return in E.164 format (e.g., +911234567890)
        return phoneNumber.format('E.164');
    } catch (error) {
        // If parsing fails, return null
        return null;
    }
}

/**
 * Validate a phone number without formatting
 * @param phone - Raw phone number string
 * @param defaultCountry - Default country code
 * @returns Boolean indicating if the phone number is valid
 */
export function isValidPhoneNumber(
    phone: string,
    defaultCountry: CountryCode = 'IN'
): boolean {
    if (!phone || typeof phone !== 'string') {
        return false;
    }

    try {
        const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
        return phoneNumber ? phoneNumber.isValid() : false;
    } catch (error) {
        return false;
    }
}

/**
 * Get the country code from a phone number
 * @param phone - Phone number string
 * @param defaultCountry - Default country code
 * @returns Country code or null if invalid
 */
export function getPhoneCountryCode(
    phone: string,
    defaultCountry: CountryCode = 'IN'
): string | null {
    if (!phone || typeof phone !== 'string') {
        return null;
    }

    try {
        const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
        if (phoneNumber && phoneNumber.isValid()) {
            return phoneNumber.country || null;
        }
        return null;
    } catch (error) {
        return null;
    }
}"# Trigger rebuild" 
