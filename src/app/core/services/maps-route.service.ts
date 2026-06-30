import { Injectable } from '@angular/core';

/**
 * Builds a Google Maps Directions deep link from an ordered list of stops.
 * First stop = origin, last = destination, everything in between = waypoints.
 */
@Injectable({ providedIn: 'root' })
export class MapsRouteService {
  buildDirectionsUrl(stops: string[]): string {
    const list = stops.map(s => s.trim()).filter(Boolean);
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
  }
}
