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

    // NEW: Handle multiple transforms separated by commas
    if (transformStr.includes(',')) {
      return this.applyMultipleTransforms(value, transformStr, context);
    }

    // Apply single transform
    return this.applySingleTransform(value, transformStr, context);
  }

  /**
   * Apply multiple transforms in sequence, separated by commas
   */
  private applyMultipleTransforms(value: any, transformStr: string, context?: any): any {
    // Split by comma but be careful with regex patterns that might contain commas
    const transforms = this.parseTransforms(transformStr);
    
    let result = value;
    for (const transform of transforms) {
      result = this.applySingleTransform(result, transform.trim(), context);
    }
    
    return result;
  }

  /**
   * Parse transforms while respecting regex patterns that contain commas
   */
  private parseTransforms(transformStr: string): string[] {
    const transforms: string[] = [];
    let current = '';
    let insideRegex = false;
    
    for (let i = 0; i < transformStr.length; i++) {
      const char = transformStr[i];
      const nextChar = transformStr[i + 1];
      
      if (char === 's' && nextChar === '/' && !insideRegex) {
        insideRegex = true;
        current += char;
      } else if (char === '/' && insideRegex) {
        // Count slashes to know when regex ends (s/pattern/replacement/flags)
        const slashCount = (current.match(/\//g) || []).length;
        current += char;
        if (slashCount >= 2) { // Third slash means end of regex
          insideRegex = false;
        }
      } else if (char === ',' && !insideRegex) {
        if (current.trim()) {
          transforms.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      transforms.push(current.trim());
    }
    
    return transforms;
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
        const [, pattern, replacement, flags] = transformStr.split('/');
        return String(value).replace(new RegExp(pattern, flags), replacement);
      } catch (e) {
        console.error('Invalid regex transform:', transformStr, e);
        return value;
      }
    }

    // Link generation
    if (transformStr.startsWith('link:')) {
      return this.generateLink(value, transformStr);
    }

    // Regex-based concatenation
    if (transformStr.includes('+') && transformStr.includes('regex:')) {
      return this.regexConcatenation(value, transformStr, context);
    }

    // Existing concatenation logic (unchanged)
    if (transformStr.includes('+')) {
      const fieldPaths = transformStr.match(/([a-zA-Z0-9\._-]+)/g) || [];
      let evaluatedStr = transformStr;
      
      fieldPaths.forEach(path => {
        if (!path.startsWith("'") && !path.startsWith('"')) {
          const fieldValue = get(context, path, '');
          evaluatedStr = evaluatedStr.replace(path, `'${fieldValue}'`);
        }
      });
      
      try {
        return new Function(`return ${evaluatedStr}`)();
      } catch (e) {
        console.error('Invalid concatenation transform:', transformStr, e);
        return value;
      }
    }
    
    return value;
  }

  /**
   * REGEX CONCATENATION: Handle regex patterns in concatenation
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
   * LINK GENERATION: Create clickable links
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
 * 1. Multiple string replacements (your requirement):
 * transform: "s/op(.+?)output file is in/$1 output file/g, s/op(.+?)input file is in/$1 input file/g"
 * 
 * 2. Cleanup then add link:
 * transform: "s/op(.+?)output file is in/$1 output file/g, link:activity"
 * 
 * 3. Multiple regex + period:
 * transform: "regex:^(\\w+) + '.' + regex:(\\w+)$, link:transaction"
 * 
 * 4. Chain multiple operations:
 * transform: "s/op(.+?)output file is in/$1 output file/g, s/op(.+?)input file is in/$1 input file/g, link:activity"
 */