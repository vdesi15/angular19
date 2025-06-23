import { Injectable } from '@angular/core';
import { DateTimeRange, DateTimeUnit } from '../models/search-filter.model';
import { Params } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class DateTimeService {

  constructor() { }

  public calculateDatesFromRelative(value: number, unit: DateTimeUnit): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date(endDate);
    switch (unit) {
      case DateTimeUnit.Minutes: startDate.setMinutes(endDate.getMinutes() - value); break;
      case DateTimeUnit.Hours: startDate.setHours(endDate.getHours() - value); break;
      case DateTimeUnit.Days: startDate.setDate(endDate.getDate() - value); break;
    }
    return { startDate, endDate };
  }
  
  public formatAbsoluteRangeText(start: Date, end: Date): string {
    const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    return `${formatter.format(start)} to ${formatter.format(end)}`;
  }

  public getUnitLabel(unit: DateTimeUnit, value: number): string {
    const plural = value !== 1;
    switch (unit) {
      case DateTimeUnit.Minutes: return plural ? 'minutes' : 'minute';
      case DateTimeUnit.Hours: return plural ? 'hours' : 'hour';
      case DateTimeUnit.Days: return plural ? 'days' : 'day';
    }
  }

  /**
   * This logic was moved from FiltersService to be centralized here.
   */
  public calculateDateRangeFromUrlParams(params: Params): DateTimeRange {
    const decode = (v: string): string => v ? (decodeURIComponent(v) || '') : '';
    const isAbsolute = params['isAbs'] === 'true';

    if (isAbsolute) {
      const startStr = decode(params['start']);
      const endStr = decode(params['end']);
      if (startStr && endStr && !isNaN(new Date(startStr).getTime()) && !isNaN(new Date(endStr).getTime())) {
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        return { isAbsolute: true, startDate, endDate, text: this.formatAbsoluteRangeText(startDate, endDate) };
      }
    } else {
      const relValStr = decode(params['relVal']);
      const relativeValue = relValStr ? parseInt(relValStr, 10) : 15;
      const relativeUnit = (decode(params['relUnit']) as DateTimeUnit) || DateTimeUnit.Minutes;
      if (!isNaN(relativeValue)) {
        const { startDate, endDate } = this.calculateDatesFromRelative(relativeValue, relativeUnit);
        return { isAbsolute: false, startDate, endDate, relativeValue, relativeUnit, text: `Last ${relativeValue} ${this.getUnitLabel(relativeUnit, relativeValue)}` };
      }
    }
    const { startDate, endDate } = this.calculateDatesFromRelative(15, DateTimeUnit.Minutes);
    return { isAbsolute: false, startDate, endDate, relativeValue: 15, relativeUnit: DateTimeUnit.Minutes, text: 'Last 15 minutes' };
  }
}