import { Pipe, PipeTransform, inject } from '@angular/core';
import { DateTimeService } from '../services/date-time.service';
import { FiltersService } from '../services/filters.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { get } from 'lodash-es';

@Pipe({
  name: 'transform',
  standalone: true
})
export class TransformPipe implements PipeTransform {
  private dateTimeService = inject(DateTimeService);
  private filtersService = inject(FiltersService);
  private domSanitizer = inject(DomSanitizer);

  transform(value: any, transformStr?: string, context?: any): any {
    if (!transformStr || value == null) {
      return value;
    }

    // NEW: Handle multiple transforms separated by pipes
    if (transformStr.includes('|')) {
      return this.applyMultipleTransforms(value, transformStr, context);
    }

    // Apply single transform
    return this.applySingleTransform(value, transformStr, context);
  }

  /**
   * Apply multiple transforms in sequence, separated by pipes
   */
  private applyMultipleTransforms(value: any, transformStr: string, context?: any): any {
    const transforms = transformStr.split('|').map(t => t.trim());
    
    let result = value;
    for (const transform of transforms) {
      result = this.applySingleTransform(result, transform, context);
    }
    
    return result;
  }

  /**
   * Apply a single transform
   */
  private applySingleTransform(value: any, transformStr: string, context?: any): any {
    // Existing transforms
    if (transformStr === 'localDateTime') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date.toLocaleString();
    }
    
    if (transformStr === 'locationTime') {
      const location = this.filtersService.filters()?.location;
      const timezone = this.filtersService.searchFilterMetadata()?.locationTimezone[location || ''];
      const date = new Date(value);
      if (isNaN(date.getTime()) || !timezone) return value;
      return date.toLocaleString('en-US', { timeZone: timezone });
    }

    if (transformStr.startsWith('s/')) {
      try {
        // Parse s/pattern/replacement/flags properly
        const parts = transformStr.slice(2); // Remove 's/'
        const firstSlash = parts.indexOf('/');
        if (firstSlash === -1) throw new Error('Invalid s/ format');
        
        const pattern = parts.slice(0, firstSlash);
        const remaining = parts.slice(firstSlash + 1);
        const lastSlash = remaining.lastIndexOf('/');
        
        let replacement, flags;
        if (lastSlash === -1) {
          // No flags, just s/pattern/replacement
          replacement = remaining;
          flags = '';
        } else {
          // Has flags: s/pattern/replacement/flags
          replacement = remaining.slice(0, lastSlash);
          flags = remaining.slice(lastSlash + 1);
        }
        
        return String(value).replace(new RegExp(pattern, flags), replacement);
      } catch (e) {
        console.error('Invalid regex transform:', transformStr, e);
        return value;
      }
    }

    // NEW: Link generation
    if (transformStr.startsWith('link:')) {
      return this.generateLink(value, transformStr);
    }

    // ENHANCED: Regex-based concatenation
    if (transformStr.includes('+') && transformStr.includes('regex:')) {
      return this.regexConcatenation(value, transformStr, context);
    }

    // Existing concatenation logic (unchanged)
    if (transformStr.includes('+')) {
  try {
    // Split by '+' and handle each part
    const parts = transformStr.split('+').map(p => p.trim());
    let result = '';

    for (const part of parts) {
      if (part.startsWith("'") && part.endsWith("'")) {
        // Literal string like '.' or ','
        result += part.slice(1, -1); // Remove quotes
      } else if (part.startsWith('"') && part.endsWith('"')) {
        // Double quoted literal string
        result += part.slice(1, -1); // Remove quotes
      } else {
        // Field path - only process if it looks like a valid field path
        if (part.includes('.') && part.length > 1) {
          const fieldValue = get(context, part, '');
          result += String(fieldValue);
        } else {
          // If it's not a valid field path, treat as literal
          result += part;
        }
      }
    }

    return result;
  } catch (e) {
    console.error('Invalid concatenation transform:', transformStr, e);
    return value;
  }
    
    return value;
  }

  /**
   * 1. REGEX CONCATENATION: Handle regex patterns in concatenation
   * Example: regex:^(\w+) + '.' + regex:(\w+)$
   */
  private regexConcatenation(value: any, transformStr: string, context?: any): string {
    const str = String(value);
    
    try {
      // Split by '+' but keep quoted strings intact
      const parts = transformStr.split('+').map(p => p.trim());
      let result = '';

      for (const part of parts) {
        if (part.startsWith("'") && part.endsWith("'")) {
          // Literal string like '.'
          result += part.slice(1, -1);
        } else if (part.startsWith('regex:')) {
          // Regex extraction: regex:pattern
          const pattern = part.substring(6);
          const match = str.match(new RegExp(pattern));
          if (match && match[1]) {
            result += match[1]; // Use first capture group
          } else if (match && match[0]) {
            result += match[0]; // Use full match if no capture group
          }
        } else if (!part.startsWith("'") && !part.startsWith('"')) {
          // Field path
          const fieldValue = get(context, part, '');
          result += String(fieldValue);
        }
      }

      return result;
    } catch (e) {
      console.error('Invalid regex concatenation:', transformStr, e);
      return String(value);
    }
  }

  /**
   * 3. LINK GENERATION: Create clickable links
   * Example: link:activity creates a search link
   */
  private generateLink(value: any, transformStr: string): SafeHtml {
    const linkType = transformStr.split(':')[1];
    const currentApp = this.filtersService.filters()?.application?.[0] || '';
    
    let url = '';
    
    switch (linkType) {
      case 'activity':
        url = `/logs/search?applications=${encodeURIComponent(currentApp)}&searchText=${encodeURIComponent(value)}`;
        break;
      case 'transaction':
        url = `/logs/search?type=transaction&query=${encodeURIComponent(value)}`;
        break;
      case 'jira':
        url = `https://your-jira.com/browse/${encodeURIComponent(value)}`;
        break;
      default:
        return value; // Return original value if unknown link type
    }

    const linkHtml = `<a href="${url}" target="_blank" class="transform-link">${value}</a>`;
    return this.domSanitizer.bypassSecurityTrustHtml(linkHtml);
  }
}

/**
 * USAGE EXAMPLES:
 * 
 * 1. Multiple string replacements:
 * transform: "s/op(.+?)output file is in/$1 output file/g | s/op(.+?)input file is in/$1 input file/g"
 * 
 * 2. String concatenation with comma then link:
 * transform: "_source.user.firstname + ',' + _source.user.lastname | link:profile"
 * 
 * 3. Cleanup then add link:
 * transform: "s/op(.+?)output file is in/$1 output file/g | link:activity"
 * 
 * 4. Regex concatenation then link:
 * transform: "regex:^(\\w+) + '.' + regex:(\\w+)$ | link:transaction"
 * 
 * 5. Multiple operations chained:
 * transform: "s/op(.+?)output file is in/$1 output file/g | s/op(.+?)input file is in/$1 input file/g | link:activity"
 * 
 * // If you need more flexibility for special characters:
*  "s/op\\s+([^o]+?)\\s+output file is in/$1 output file/g"
*   "s/op\\s+([^i]+?)\\s+input file is in/$1 input file/g"
 */