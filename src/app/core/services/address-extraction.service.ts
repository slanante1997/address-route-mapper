import { Injectable } from '@angular/core';
import { LocationDefaults } from '../models/location-defaults.model';

/**
 * Turns an uploaded image into a list of address strings by calling the
 * serverless proxy (/api/extract), which holds the Gemini API key server-side.
 */
@Injectable({ providedIn: 'root' })
export class AddressExtractionService {
  async extractFromImage(file: File, location: LocationDefaults): Promise<string[]> {
    const base64 = await this.fileToBase64(file);

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64,
        mimeType: file.type,
        city: location.city,
        state: location.state,
        zip: location.zip,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error ?? `Address extraction failed (${res.status}).`);
    }

    const addresses = data?.addresses;
    return Array.isArray(addresses)
      ? addresses.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];
  }

  // Reads the file as base64 and strips the "data:<mime>;base64," prefix the API doesn't accept.
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
