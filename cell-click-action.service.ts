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
   * Format content based on the specified format
   */
  private formatContent(content: any, format: string): string {
    if (content === null || content === undefined) {
      return 'No data available';
    }

    if (typeof content === 'string') {
      return format === 'xml' ? this.prettyXML(content) : content;
    }

    if (format === 'json') {
      return JSON.stringify(content, null, 2);
    }

    if (format === 'xml') {
      return this.prettyXML(JSON.stringify(content, null, 2));
    }

    return String(content);
  }

  /**
   * Pretty format XML string
   */
  private prettyXML(xml: string): string {
    try {
      // First, preserve CDATA sections by replacing them with placeholders
      const cdataPlaceholders: { [key: string]: string } = {};
      let cdataCounter = 0;
      
      // Extract and preserve CDATA sections
      xml = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match, content) => {
        const placeholder = `__CDATA_PLACEHOLDER_${cdataCounter}__`;
        cdataPlaceholders[placeholder] = match;
        cdataCounter++;
        return placeholder;
      });

      // Parse and format the XML without CDATA
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      
      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.warn('[CellClickActionService] XML parsing failed, using manual formatting');
        return this.manualXMLFormat(xml, cdataPlaceholders);
      }

      // Serialize the formatted XML
      const serializer = new XMLSerializer();
      let formattedXML = serializer.serializeToString(xmlDoc);
      
      // Restore CDATA placeholders with proper formatting
      Object.entries(cdataPlaceholders).forEach(([placeholder, cdataContent]) => {
        // Format CDATA content with proper indentation and line breaks
        const formattedCDATA = this.formatCDATAContent(cdataContent);
        formattedXML = formattedXML.replace(placeholder, formattedCDATA);
      });

      // Apply basic XML formatting
      return this.applyXMLIndentation(formattedXML);
      
    } catch (error) {
      console.warn('[CellClickActionService] XML formatting failed, returning original:', error);
      return xml;
    }
  }

  /**
   * Manual XML formatting for cases where DOMParser fails
   */
  private manualXMLFormat(xml: string, cdataPlaceholders: { [key: string]: string }): string {
    // Restore CDATA sections first
    Object.entries(cdataPlaceholders).forEach(([placeholder, cdataContent]) => {
      xml = xml.replace(placeholder, cdataContent);
    });

    // Apply basic XML formatting
    return this.applyXMLIndentation(xml);
  }

  /**
   * Format CDATA content with proper structure for Monaco folding
   */
  private formatCDATAContent(cdataContent: string): string {
    const match = cdataContent.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    if (!match) return cdataContent;

    const innerContent = match[1];
    
    // If CDATA content is empty or whitespace only
    if (!innerContent.trim()) {
      return '<![CDATA[]]>';
    }

    // If CDATA content is short (single line), keep it inline
    if (innerContent.length < 100 && !innerContent.includes('\n')) {
      return `<![CDATA[${innerContent.trim()}]]>`;
    }

    // For longer content, format with line breaks for proper folding
    const trimmedContent = innerContent.trim();
    return `<![CDATA[\n${trimmedContent}\n]]>`;
  }

  /**
   * Apply proper XML indentation
   */
  private applyXMLIndentation(xml: string): string {
    let formatted = '';
    let indent = 0;
    const indentSize = 4; // Use 4 spaces to match our editor settings
    
    // Split by tags while preserving CDATA sections
    const parts = xml.split(/(<[^>]*>)/);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      if (part.startsWith('</')) {
        // Closing tag - decrease indent before adding
        indent = Math.max(0, indent - indentSize);
        formatted += ' '.repeat(indent) + part + '\n';
      } else if (part.startsWith('<![CDATA[')) {
        // CDATA section - handle specially
        const cdataLines = part.split('\n');
        for (let j = 0; j < cdataLines.length; j++) {
          if (j === 0) {
            formatted += ' '.repeat(indent) + cdataLines[j];
          } else {
            formatted += '\n' + ' '.repeat(indent + indentSize) + cdataLines[j].trim();
          }
        }
        formatted += '\n';
      } else if (part.startsWith('<') && !part.endsWith('/>')) {
        // Opening tag
        formatted += ' '.repeat(indent) + part + '\n';
        // Only increase indent if it's not a self-closing tag or CDATA
        if (!part.includes('CDATA') && !part.endsWith('/>')) {
          indent += indentSize;
        }
      } else if (part.startsWith('<') && part.endsWith('/>')) {
        // Self-closing tag
        formatted += ' '.repeat(indent) + part + '\n';
      } else {
        // Text content
        if (part.length > 0) {
          formatted += ' '.repeat(indent) + part + '\n';
        }
      }
    }

    return formatted.trim();
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