// src/app/shared/components/editor-dialog/editor-dialog.component.ts
import { 
  Component, 
  inject, 
  signal, 
  computed, 
  WritableSignal, 
  AfterViewInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Modules
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

// Services
import { CellClickActionService, EditorConfig } from '../../../core/services/cell-click-action.service';

// Monaco Editor Types
declare const monaco: any;

@Component({
  selector: 'app-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TabViewModule,
    TooltipModule
  ],
  template: `
    <p-dialog 
      [visible]="isVisible()" 
      [modal]="true"
      [closable]="false"
      [resizable]="false"
      [draggable]="false"
      styleClass="editor-dialog"
      [style]="{ width: '90vw', height: '85vh' }"
      [contentStyle]="{ padding: '0', height: '100%' }"
      (onHide)="onDialogHide()">
      
      <ng-template pTemplate="header">
        <span class="editor-dialog-title">{{ config()?.title || 'Code Editor' }}</span>
      </ng-template>

      <div class="editor-content" *ngIf="config()">
        <p-tabView 
          *ngIf="config()!.tabs.length > 1; else singleTab"
          styleClass="editor-tabs"
          [style]="{ height: '100%' }">
          
          <p-tabPanel 
            *ngFor="let tab of config()!.tabs; trackBy: trackByTabTitle" 
            [header]="tab.title">
            <div 
              class="monaco-editor-container" 
              #editorContainer
              [attr.data-format]="tab.format">
            </div>
          </p-tabPanel>
        </p-tabView>

        <ng-template #singleTab>
          <div 
            class="monaco-editor-container single-editor" 
            #editorContainer
            [attr.data-format]="config()!.tabs[0].format">
          </div>
        </ng-template>
      </div>

      <ng-template pTemplate="footer">
        <div class="editor-dialog-footer">
          <p-button 
            [text]="true"
            severity="secondary"
            icon="pi pi-map"
            label="Toggle Minimap"
            pTooltip="Toggle minimap visibility"
            (onClick)="toggleMinimap()" />
          
          <p-button 
            [text]="true"
            severity="secondary"
            icon="pi pi-arrows-h"
            label="Toggle Word Wrap"
            pTooltip="Toggle word wrap"
            (onClick)="toggleWordWrap()" />
          
          <p-button 
            [text]="true"
            severity="secondary"
            icon="pi pi-copy"
            label="Copy to Clipboard"
            pTooltip="Copy content to clipboard"
            (onClick)="copyToClipboard()" />
          
          <p-button 
            severity="secondary"
            icon="pi pi-times"
            label="Close"
            (onClick)="closeDialog()" />
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host ::ng-deep .editor-dialog {
      .p-dialog {
        background: var(--surface-ground);
        border: 1px solid var(--surface-border);
      }
      
      .p-dialog-header {
        background: var(--surface-section);
        border-bottom: 1px solid var(--surface-border);
        padding: 1rem 1.5rem;
      }
      
      .p-dialog-content {
        padding: 0 !important;
        height: calc(100% - 60px);
        overflow: hidden;
      }
      
      .p-dialog-footer {
        background: var(--surface-section);
        border-top: 1px solid var(--surface-border);
        padding: 1rem 1.5rem;
      }
    }

    .editor-dialog-title {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text-color);
    }

    .editor-content {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    :host ::ng-deep .editor-tabs {
      height: 100%;
      
      .p-tabview-panels {
        height: calc(100% - 60px);
        padding: 0;
      }
      
      .p-tabview-panel {
        height: 100%;
        padding: 0 !important;
      }
    }

    .monaco-editor-container {
      width: 100%;
      height: 100%;
      min-height: 400px;
      border: 1px solid var(--surface-border);
    }

    .single-editor {
      height: calc(100vh - 220px);
    }

    .editor-dialog-footer {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      align-items: center;
    }

    /* Dark mode support */
    :host-context(.app-dark) ::ng-deep .editor-dialog {
      .p-dialog {
        background: var(--surface-ground);
      }
    }
  `]
})
export class EditorDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer') editorContainer!: ElementRef;

  private cellClickActionService = inject(CellClickActionService);
  private messageService = inject(MessageService);

  // State signals
  private _monacoEditors: WritableSignal<any[]> = signal([]);
  private _activeTabIndex: WritableSignal<number> = signal(0);
  private _minimapEnabled: WritableSignal<boolean> = signal(true);
  private _wordWrapEnabled: WritableSignal<boolean> = signal(false);

  // Public computed signals
  public readonly isVisible = computed(() => this.cellClickActionService.isEditorVisible());
  public readonly config = computed(() => this.cellClickActionService.editorConfig());
  public readonly activeEditor = computed(() => {
    const editors = this._monacoEditors();
    const index = this._activeTabIndex();
    return editors[index] || null;
  });

  constructor() {
    // Load Monaco Editor
    this.loadMonacoEditor();

    // Effect to handle editor creation when config changes
    effect(() => {
      const config = this.config();
      if (config && this.isVisible()) {
        // Small delay to ensure DOM is ready
        setTimeout(() => this.initializeEditors(), 100);
      }
    });
  }

  ngAfterViewInit(): void {
    // Additional initialization if needed
  }

  ngOnDestroy(): void {
    this.disposeEditors();
  }

  /**
   * Load Monaco Editor dynamically
   */
  private async loadMonacoEditor(): Promise<void> {
    if (typeof monaco !== 'undefined') {
      return;
    }

    try {
      // Load Monaco Editor from CDN
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js');
      
      (window as any).require.config({ 
        paths: { 
          vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' 
        } 
      });

      await new Promise<void>((resolve) => {
        (window as any).require(['vs/editor/editor.main'], () => {
          resolve();
        });
      });
    } catch (error) {
      console.error('[EditorDialog] Failed to load Monaco Editor:', error);
    }
  }

  /**
   * Load external script
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize Monaco editors for all tabs
   */
  private initializeEditors(): void {
    const config = this.config();
    if (!config || typeof monaco === 'undefined') {
      return;
    }

    this.disposeEditors();
    
    const editors: any[] = [];
    const containers = document.querySelectorAll('.monaco-editor-container');

    containers.forEach((container, index) => {
      const tab = config.tabs[index];
      if (!tab) return;

      const editor = monaco.editor.create(container as HTMLElement, {
        value: tab.content,
        language: this.getMonacoLanguage(tab.format),
        theme: document.body.classList.contains('app-dark') ? 'vs-dark' : 'vs',
        readOnly: true,
        minimap: { enabled: this._minimapEnabled() },
        wordWrap: this._wordWrapEnabled() ? 'on' : 'off',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        renderWhitespace: 'selection'
      });

      editors.push(editor);
    });

    this._monacoEditors.set(editors);
  }

  /**
   * Get Monaco language identifier from format
   */
  private getMonacoLanguage(format: string): string {
    switch (format) {
      case 'json': return 'json';
      case 'xml': return 'xml';
      case 'yaml': return 'yaml';
      case 'text':
      default: return 'plaintext';
    }
  }

  /**
   * Toggle minimap for all editors
   */
  public toggleMinimap(): void {
    const newState = !this._minimapEnabled();
    this._minimapEnabled.set(newState);
    
    this._monacoEditors().forEach(editor => {
      editor.updateOptions({ minimap: { enabled: newState } });
    });
  }

  /**
   * Toggle word wrap for all editors
   */
  public toggleWordWrap(): void {
    const newState = !this._wordWrapEnabled();
    this._wordWrapEnabled.set(newState);
    
    this._monacoEditors().forEach(editor => {
      editor.updateOptions({ wordWrap: newState ? 'on' : 'off' });
    });
  }

  /**
   * Copy active editor content to clipboard
   */
  public async copyToClipboard(): Promise<void> {
    const activeEditor = this.activeEditor();
    if (!activeEditor) return;

    try {
      const content = activeEditor.getValue();
      await navigator.clipboard.writeText(content);
      
      this.messageService.add({
        severity: 'success',
        summary: 'Copied',
        detail: 'Content copied to clipboard',
        life: 2000
      });
    } catch (error) {
      console.error('[EditorDialog] Failed to copy to clipboard:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Copy Failed',
        detail: 'Failed to copy content to clipboard',
        life: 3000
      });
    }
  }

  /**
   * Close the editor dialog
   */
  public closeDialog(): void {
    this.cellClickActionService.hideEditor();
  }

  /**
   * Handle dialog hide event
   */
  public onDialogHide(): void {
    this.disposeEditors();
  }

  /**
   * Dispose all Monaco editors
   */
  private disposeEditors(): void {
    this._monacoEditors().forEach(editor => {
      if (editor && editor.dispose) {
        editor.dispose();
      }
    });
    this._monacoEditors.set([]);
  }

  /**
   * Track by function for tab iteration
   */
  public trackByTabTitle(index: number, tab: any): string {
    return tab.title;
  }
}