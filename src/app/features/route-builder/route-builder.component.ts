import { Component, computed, inject, signal } from '@angular/core';
import { Stop } from '../../core/models/stop.model';
import { AddressExtractionService } from '../../core/services/address-extraction.service';
import { MapsRouteService } from '../../core/services/maps-route.service';

@Component({
  selector: 'app-route-builder',
  imports: [],
  templateUrl: './route-builder.component.html',
  styleUrl: './route-builder.component.css',
})
export class RouteBuilderComponent {
  private readonly extraction = inject(AddressExtractionService);
  private readonly maps = inject(MapsRouteService);

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

  // Rebuilds the Maps link automatically whenever stops change.
  protected readonly mapsUrl = computed(() =>
    this.maps.buildDirectionsUrl(this.stops().map(s => s.text)),
  );

  private nextId = 0;

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
      const addresses = await this.extraction.extractFromImage(file, {
        city: this.city().trim(),
        state: this.state().trim(),
        zip: this.zip().trim(),
      });
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
