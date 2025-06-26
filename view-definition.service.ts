import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, shareReplay, map } from 'rxjs';
import { ViewDefinition } from '../models/view-definition.model';

@Injectable({ providedIn: 'root' })
export class ViewDefinitionService {
  private http = inject(HttpClient);
  private views: WritableSignal<ViewDefinition[] | null> = signal(null);

  loadViews() {
    return this.http.get<any>('/api/getcolumns').pipe( // Uses the same endpoint
      map(response => response['views.filter'] ?? []),
      tap(data => this.views.set(data)),
      shareReplay(1)
    );
  }

  getViewsForApp(appName: string): ViewDefinition[] {
    const allViews = this.views();
    if (!allViews) return [];
    return allViews.filter(view => view.apps.includes(appName));
  }

  private evaluateSimpleFilter(source: any, filter: string): boolean {
  try {
    // Clean the filter (remove JSONPath prefixes)
    const cleanFilter = filter.replace(/\$\./g, '').replace(/\$\._source\./g, '');
    
    // STEP 1: Split by OR (||) first - because OR has LOWER precedence
    // Examples:
    // "service.name == 'a' || service.type" → ["service.name == 'a'", "service.type"]
    // "log.level == 'ERROR' && service.name || http.status >= '400'" → ["log.level == 'ERROR' && service.name", "http.status >= '400'"]
    const orConditions = cleanFilter.split('||').map(s => s.trim());
    
    console.log('🔍 OR conditions:', orConditions);
    
    // STEP 2: For OR logic - if ANY condition is true, return true
    return orConditions.some(orCondition => {
      console.log('🔍 Evaluating OR condition:', orCondition);
      
      // STEP 3: Split each OR part by AND (&&) - because AND has HIGHER precedence
      // Examples:
      // "log.level == 'ERROR' && service.name" → ["log.level == 'ERROR'", "service.name"]
      // "service.name == 'a'" → ["service.name == 'a'"]  (single condition)
      const andConditions = orCondition.split('&&').map(s => s.trim());
      
      console.log('🔍 AND conditions:', andConditions);
      
      // STEP 4: For AND logic - ALL conditions must be true
      return andConditions.every(condition => {
        const result = this.evaluateCondition(source, condition);
        console.log(`🔍 Condition "${condition}" = ${result}`);
        return result;
      });
    });
    
  } catch (error) {
    console.warn('[ViewDefinitionService] Filter evaluation failed:', error);
    return true; // Include on error
  }
}

  /**
 * The evaluateCondition method handles individual conditions:
 */
private evaluateCondition(source: any, condition: string): boolean {
  console.log(`🔍 Evaluating condition: "${condition}"`);
  
  // Check for equality: field == 'value'
  const eqMatch = condition.match(/^(.+?)\s*==\s*'(.+)'$/);
  if (eqMatch) {
    const [, fieldPath, expectedValue] = eqMatch;
    const actualValue = get(source, fieldPath.trim());
    const result = String(actualValue) === expectedValue;
    console.log(`🔍 Equality check: ${fieldPath} (${actualValue}) == '${expectedValue}' = ${result}`);
    return result;
  }

  // Check for inequality: field != 'value'
  const neMatch = condition.match(/^(.+?)\s*!=\s*'(.+)'$/);
  if (neMatch) {
    const [, fieldPath, expectedValue] = neMatch;
    const actualValue = get(source, fieldPath.trim());
    const result = String(actualValue) !== expectedValue;
    console.log(`🔍 Inequality check: ${fieldPath} (${actualValue}) != '${expectedValue}' = ${result}`);
    return result;
  }

  // Check for numeric comparison: field >= '400'
  const numMatch = condition.match(/^(.+?)\s*(>=|<=|>|<)\s*'?(\d+)'?$/);
  if (numMatch) {
    const [, fieldPath, operator, expectedValue] = numMatch;
    const actualValue = Number(get(source, fieldPath.trim()));
    const expected = Number(expectedValue);
    
    let result = false;
    switch (operator) {
      case '>': result = actualValue > expected; break;
      case '<': result = actualValue < expected; break;
      case '>=': result = actualValue >= expected; break;
      case '<=': result = actualValue <= expected; break;
    }
    console.log(`🔍 Numeric comparison: ${fieldPath} (${actualValue}) ${operator} ${expected} = ${result}`);
    return result;
  }

  // Existence check: just field name (CASE 4)
  const fieldValue = get(source, condition.trim());
  const exists = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
  console.log(`🔍 Existence check: ${condition} = ${exists} (value: ${fieldValue})`);
  return exists;
}
}