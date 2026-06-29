import { Component, signal, computed } from '@angular/core';
import { GEMINI_API_KEY } from './gemini-key';

interface Stop {
  id: number;
  text: string;
}

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly stops = signal<Stop[]>([]);
  protected readonly status = signal('');
  protected readonly busy = signal(false);
  protected readonly previewUrl = signal<string | null>(null);
  // Optional defaults applied to any extracted address that's missing them.
  protected readonly city = signal('');
  protected readonly state = signal('');
  protected readonly zip = signal('');

  private nextId = 0;

  // Rebuilds the Maps link automatically whenever stops change.
  protected readonly mapsUrl = computed(() => {
    const list = this.stops().map(s => s.text.trim()).filter(Boolean);
    if (list.length < 2) return '';

    const origin = list[0];
    const destination = list[list.length - 1];
    const waypoints = list.slice(1, -1);

    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving',
    });
    if (waypoints.length) {
      params.set('waypoints', waypoints.join('|'));
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  });

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!GEMINI_API_KEY) {
      this.status.set('No Gemini API key configured in gemini-key.ts.');
      return;
    }

    this.previewUrl.set(URL.createObjectURL(file));
    this.busy.set(true);
    this.status.set('Reading addresses with Gemini…');

    try {
      const base64 = await this.fileToBase64(file);
      const addresses = await this.extractAddresses(base64, file.type);
      this.stops.set(addresses.map(text => ({ id: this.nextId++, text })));
      this.status.set(
        addresses.length
          ? 'Done — review and clean up the list below.'
          : 'No addresses found in that image.',
      );
    } catch (err) {
      console.error(err);
      this.status.set(
        err instanceof Error ? err.message : 'Something went wrong reading that image.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  // Reads the file as base64 and strips the "data:<mime>;base64," prefix Gemini doesn't accept.
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

  // Builds an instruction telling Gemini to fill in any missing city/state/ZIP.
  private locationHint(): string {
    const parts = [
      this.city().trim() && `city "${this.city().trim()}"`,
      this.state().trim() && `state "${this.state().trim()}"`,
      this.zip().trim() && `ZIP code "${this.zip().trim()}"`,
    ].filter(Boolean);

    if (!parts.length) return '';
    return (
      ' If an address is missing the city, state, or ZIP code, complete it using ' +
      parts.join(', ') +
      '. Do not override values already present in the image.'
    );
  }

  // Sends the image to Gemini and asks for a JSON array of address strings.
  private async extractAddresses(base64: string, mimeType: string): Promise<string[]> {
    const body = {
      contents: [
        {
          parts: [
            {
              text:
                'Extract every mailing/street address visible in this image. ' +
                'Return them in the order they appear, one entry per stop, each on a single line. ' +
                'Ignore non-address text such as headers, names, phone numbers, or notes.' +
                this.locationHint(),
            },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
    };

    const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini request failed (${res.status}). ${detail.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const parsed = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];
  }

  protected updateStop(id: number, value: string): void {
    this.stops.update(list =>
      list.map(s => (s.id === id ? { ...s, text: value } : s)),
    );
  }

  protected removeStop(id: number): void {
    this.stops.update(list => list.filter(s => s.id !== id));
  }

  protected addStop(): void {
    this.stops.update(list => [...list, { id: this.nextId++, text: '' }]);
  }
}
