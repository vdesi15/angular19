import { Pipe, PipeTransform, inject } from '@angular/core';
import { DateTimeService } from '../services/date-time.service';
import { FiltersService } from '../services/filters.service';
import { get } from 'lodash-es';

@Pipe({
  name: 'transform',
  standalone: true
})
export class TransformPipe implements PipeTransform {
  private dateTimeService = inject(DateTimeService);
  private filtersService = inject(FiltersService);

  transform(value: any, transformStr?: string, context?: any): any {
    if (!transformStr || value == null) {
      return value;
    }

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
}