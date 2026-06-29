import { Component, signal, computed } from '@angular/core';

interface Stop {
  id: number;
  text: string;
}

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
  // Required defaults applied to any extracted address that's missing them.
  protected readonly city = signal('');
  protected readonly state = signal('');
  protected readonly zip = signal('');

  // Upload is gated until at least a city or state is provided (ZIP is optional).
  protected readonly locationReady = computed(
    () => !!this.city().trim() || !!this.state().trim(),
  );

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

    if (!this.locationReady()) {
      this.status.set('Enter at least a city or state before uploading.');
      return;
    }

    this.previewUrl.set(URL.createObjectURL(file));
    this.busy.set(true);
    this.status.set('Reading addresses…');

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

  // Sends the image to our serverless proxy, which calls Gemini with the secret key.
  private async extractAddresses(base64: string, mimeType: string): Promise<string[]> {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64,
        mimeType,
        city: this.city().trim(),
        state: this.state().trim(),
        zip: this.zip().trim(),
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
