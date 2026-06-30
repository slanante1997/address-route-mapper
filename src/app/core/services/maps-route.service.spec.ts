import { MapsRouteService } from './maps-route.service';

describe('MapsRouteService', () => {
  let service: MapsRouteService;

  beforeEach(() => {
    service = new MapsRouteService();
  });

  it('returns an empty string with fewer than two stops', () => {
    expect(service.buildDirectionsUrl([])).toBe('');
    expect(service.buildDirectionsUrl(['123 Main St'])).toBe('');
  });

  it('uses the first and last stop as origin and destination', () => {
    const url = service.buildDirectionsUrl(['123 Main St', '456 Oak Ave']);
    expect(url).toContain('origin=123+Main+St');
    expect(url).toContain('destination=456+Oak+Ave');
    expect(url).not.toContain('waypoints=');
  });

  it('puts middle stops into waypoints', () => {
    const url = service.buildDirectionsUrl(['A St', 'B St', 'C St']);
    expect(url).toContain('origin=A+St');
    expect(url).toContain('destination=C+St');
    expect(url).toContain('waypoints=B+St');
  });

  it('ignores blank entries when building the route', () => {
    const url = service.buildDirectionsUrl(['A St', '   ', 'C St']);
    expect(url).toContain('origin=A+St');
    expect(url).toContain('destination=C+St');
    expect(url).not.toContain('waypoints=');
  });
});
