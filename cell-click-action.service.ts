// src/app/core/services/cell-click-action.service.ts
import { Injectable, signal, WritableSignal, inject } from '@angular/core';
import { ColumnDefinition, TransactionDetailsResponse } from '../models/column-definition.model';
import { SearchOrchestratorService } from '../../features/search/services/search-orchestrator.service';
import { ActiveSearch } from './search.model';

export interface EditorTab {
  title: string;
  content: string;
  format: 'xml' | 'json' | 'text' | 'yaml';
}

export interface EditorConfig {
  tabs: EditorTab[];
  title: string;
}

export interface CellClickContext {
  columnDef: ColumnDefinition;
  rowData: any;
  cellValue: any;
  transactionDetails?: TransactionDetailsResponse;
  activeSearch: ActiveSearch // For actions that need full transaction context
}

@Injectable({
  providedIn: 'root'
})
export class CellClickActionService {
  private searchOrchestrator = inject(SearchOrchestratorService);
  
  private _editorConfig: WritableSignal<EditorConfig | null> = signal(null);
  private _isEditorVisible: WritableSignal<boolean> = signal(false);

  // Public readonly signals
  public readonly editorConfig = this._editorConfig.asReadonly();
  public readonly isEditorVisible = this._isEditorVisible.asReadonly();

  /**
   * Handle cell click based on column definition
   */
  public handleCellClick(context: CellClickContext): void {
    const { columnDef, rowData, cellValue } = context;
    
    if (!columnDef.onClick) {
      return;
    }

    const { action, format } = columnDef.onClick;

    try {
      // Handle different action types
      switch (action) {
        case 'OpenTransactionComponent':
          this.handleOpenTransactionComponent(rowData, cellValue, context.activeSearch);
          break;
          
        case 'ShowRawJSON':
        case 'ShowSourceInputOutputMessageinXML':
          const editorConfig = this.executeEditorAction(action, format, rowData, cellValue, context.transactionDetails);
          if (editorConfig) {
            this.showEditor(editorConfig);
          }
          break;
          
        default:
          console.warn(`[CellClickActionService] Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('[CellClickActionService] Error executing action:', error);
    }
  }

  /**
   * Handle opening transaction component (drill-down)
   */
  private handleOpenTransactionComponent(rowData: any, cellValue: any, activeSearch: ActiveSearch): void {
    if (cellValue) {
      console.log(`[CellClickActionService] Opening transaction component for: ${identifier}`);
      
      this.searchOrchestrator.performSearch({
        type: 'transaction',
        query: cellValue,
        title: `Transaction Details: ${cellValue}`,
        appName: activeSearch.appName
      });
    }
  }

  /**
   * Execute editor-based actions
   */
  private executeEditorAction(
    action: string, 
    format: string, 
    rowData: any, 
    cellValue: any,
    transactionDetails?: TransactionDetailsResponse
  ): EditorConfig | null {
    
    switch (action) {
      case 'ShowRawJSON':
        return this.handleShowRawJSON(rowData, format);
        
      case 'ShowSourceInputOutputMessageinXML':
        return this.handleShowSourceInputOutputMessageXML(rowData, format, transactionDetails);
        
      default:
        return null;
    }
  }

  /**
   * Handle ShowRawJSON action
   */
  private handleShowRawJSON(rowData: any, format: string): EditorConfig {
    const source = rowData._source || rowData;
    const prettyContent = JSON.stringify(source, null, 2);

    return {
      title: 'Raw JSON Data',
      tabs: [{
        title: 'JSON Content',
        content: prettyContent,
        format: 'json'
      }]
    };
  }

  /**
   * Handle ShowSourceInputOutputMessageinXML action with correlation data
   */
  private handleShowSourceInputOutputMessageXML(
    rowData: any, 
    format: string, 
    transactionDetails?: TransactionDetailsResponse
  ): EditorConfig {
    const tabs: EditorTab[] = [];
    
    // Get correlation ID and direction from row data
    const correlationId = get(rowData._original, '_source.event.payload.correlation_id');
    const direction = get(rowData._original, '_source.event.payload.direction');
    
    console.log(`[CellClickActionService] Looking for correlation data - ID: ${correlationId}, Direction: ${direction}`);

    // Try to get additional tab data if transaction details are available
    if (transactionDetails?.ADDITIONAL_TAB_DATA_BY_CORRID && correlationId) {
      const correlationData = transactionDetails.ADDITIONAL_TAB_DATA_BY_CORRID.find(
        item => item[correlationId]
      );

      if (correlationData?.[correlationId]) {
        const data = correlationData[correlationId];
        
        // Add input tab if available
        if (data.input !== undefined && data.input !== null) {
          tabs.push({
            title: 'Input Message',
            content: this.formatContent(data.input, format),
            format: format as 'xml' | 'json'
          });
        }

        // Add output tab if available
        if (data.output !== undefined && data.output !== null) {
          tabs.push({
            title: 'Output Message',
            content: this.formatContent(data.output, format),
            format: format as 'xml' | 'json'
          });
        }

        // Add current direction tab if we have specific direction data and it matches
        if (direction && (direction === 'input' || direction === 'output')) {
          const directionData = direction === 'input' ? data.input : data.output;
          if (directionData !== undefined && directionData !== null) {
            tabs.push({
              title: `${direction.charAt(0).toUpperCase() + direction.slice(1)} Message (Current)`,
              content: this.formatContent(directionData, format),
              format: format as 'xml' | 'json'
            });
          }
        }
      }
    }

    // Fallback: show row data payload if no additional data found
    if (tabs.length === 0) {
      const payloadData = get(rowData._original, '_source.event.payload') || 
                          get(rowData._original, '_source.payload');

      tabs.push({
        title: 'Row Data',
        content: this.formatContent(payloadData, format),
        format: format as 'xml' | 'json'
      });
    }

    return {
      title: correlationId ? `Transaction Message Data (${correlationId})` : 'Transaction Message Data',
      tabs
    };
  }

  /**
   * Format content based on the specified format using vkbeautify
   */
  private formatContent(content: any, format: string): string {
    if (content === null || content === undefined) {
      return 'No data available';
    }

    try {
      if (typeof content === 'string') {
        if (format === 'xml') {
          return this.formatXMLWithVkbeautify(content);
        }
        if (format === 'json') {
          // Try to parse and re-stringify if it's a JSON string
          try {
            const parsed = JSON.parse(content);
            return vkbeautify.json(JSON.stringify(parsed));
          } catch {
            // If not valid JSON, return as-is
            return content;
          }
        }
        return content;
      }

      if (format === 'json') {
        const jsonString = JSON.stringify(content, null, 2);
        return vkbeautify.json(jsonString);
      }

      if (format === 'xml') {
        const jsonString = JSON.stringify(content, null, 2);
        return this.formatXMLWithVkbeautify(jsonString);
      }

      return String(content);
    } catch (error) {
      console.warn('[CellClickActionService] Error formatting content:', error);
      return String(content);
    }
  }

  /**
   * Format XML using vkbeautify with enhanced options
   */
  private formatXMLWithVkbeautify(xml: string): string {
    try {
      // Clean up the XML string first
      let cleanXml = xml.trim();
      
      // If it doesn't look like XML, try to detect if it's wrapped JSON
      if (!cleanXml.startsWith('<')) {
        // Check if it's a JSON string containing XML
        try {
          const parsed = JSON.parse(cleanXml);
          if (typeof parsed === 'string' && parsed.trim().startsWith('<')) {
            cleanXml = parsed;
          }
        } catch {
          // Not JSON, proceed with original
        }
      }

      // Use vkbeautify to format XML with custom indentation
      const formatted = vkbeautify.xml(cleanXml, 2); // 2 spaces indentation
      
      return formatted;
    } catch (error) {
      console.warn('[CellClickActionService] vkbeautify XML formatting failed:', error);
      
      // Fallback to basic formatting
      return this.basicXMLFormat(xml);
    }
  }

  /**
   * Fallback basic XML formatting if vkbeautify fails
   */
  private basicXMLFormat(xml: string): string {
    try {
      return xml
        .replace(/></g, '>\n<')
        .replace(/^\s*\n/gm, '')
        .split('\n')
        .map((line, index, arr) => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          
          let indent = 0;
          for (let i = 0; i < index; i++) {
            const prevLine = arr[i].trim();
            if (prevLine.match(/<[^\/!][^>]*[^\/]>/) && !prevLine.includes('</')) {
              indent += 2;
            }
            if (prevLine.includes('</')) {
              indent = Math.max(0, indent - 2);
            }
          }
          
          if (trimmed.startsWith('</')) {
            indent = Math.max(0, indent - 2);
          }
          
          return ' '.repeat(indent) + trimmed;
        })
        .filter(line => line.trim())
        .join('\n');
    } catch (error) {
      console.warn('[CellClickActionService] Basic XML formatting failed:', error);
      return xml;
    }
  }

  /**
   * Show the editor dialog
   */
  public showEditor(config: EditorConfig): void {
    this._editorConfig.set(config);
    this._isEditorVisible.set(true);
  }

  /**
   * Hide the editor dialog
   */
  public hideEditor(): void {
    this._isEditorVisible.set(false);
    this._editorConfig.set(null);
  }
}