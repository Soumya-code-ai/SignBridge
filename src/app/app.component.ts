import { Component } from '@angular/core';
import { CitizenTerminalComponent } from './components/citizen-terminal/citizen-terminal.component';
import { OfficialConsoleComponent } from './components/official-console/official-console.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CitizenTerminalComponent, OfficialConsoleComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {}
