import { Component } from '@angular/core';
import { RouteBuilderComponent } from './features/route-builder/route-builder.component';
import { InfoPanelComponent } from './shared/info-panel/info-panel.component';

@Component({
  selector: 'app-root',
  imports: [RouteBuilderComponent, InfoPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}
