// components/search-bar/search-bar.component.ts
import { Component, EventEmitter, Output, inject, signal, computed, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    ButtonModule
  ]
})
export class SearchBarComponent {
  @Output() search = new EventEmitter<string>();

  public searchTerm: WritableSignal<string> = signal('');
  onSearchSubmit(event:Event) : void {
    event.preventDefault();
    this.search.emit(this.searchTerm());
  }
}