import { Injectable } from '@angular/core';

export interface MetricsData {
  chartData: any;
  chartOptions: any;
  totalCount: number;
  uniqueLabels: number;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionMetricsService {

  /**
   * Calculate metrics from transaction data
   */
  public calculateMetrics(data: any[]): MetricsData | null {
    if (!data?.length) {
      return null;
    }

    const metricsMap = new Map<string, number>();

    // Extract metrics from data
    for (const row of data) {
      const value = this.getNestedValue(row, '_source.metrics.value');
      const label = this.getNestedValue(row, '_source.metrics.label');
      
      if (value !== null && label) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          const labelStr = String(label);
          metricsMap.set(labelStr, (metricsMap.get(labelStr) || 0) + numValue);
        }
      }
    }

    if (metricsMap.size === 0) {
      return null;
    }

    // Convert to chart data
    const labels = Array.from(metricsMap.keys());
    const values = Array.from(metricsMap.values());
    const colors = this.generateColors(labels.length);
    const borderColors = colors.map(color => color.replace('0.8)', '1)'));

    const totalCount = values.reduce((sum, val) => sum + val, 0);

    return {
      chartData: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 2,
          hoverBackgroundColor: colors.map(color => color.replace('0.8)', '0.9)')),
          hoverBorderColor: borderColors,
          hoverBorderWidth: 3
        }]
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.getTextColor(),
              font: {
                size: 12,
                family: 'Inter, system-ui, sans-serif'
              },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: this.getTooltipBackgroundColor(),
            titleColor: this.getTextColor(),
            bodyColor: this.getTextColor(),
            borderColor: this.getBorderColor(),
            borderWidth: 1,
            cornerRadius: 6,
            displayColors: true,
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return ` ${label}: ${value} (${percentage}%)`;
              },
              footer: (tooltipItems: any[]) => {
                const total = tooltipItems[0].dataset.data.reduce((a: number, b: number) => a + b, 0);
                return `Total: ${total}`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1000,
          easing: 'easeInOutQuart'
        },
        cutout: '50%', // Makes it a donut chart
        elements: {
          arc: {
            borderWidth: 2
          }
        }
      },
      totalCount,
      uniqueLabels: labels.length
    };
  }

  /**
   * Generate colors for chart segments with professional palette
   */
  private generateColors(count: number): string[] {
    const colors = [
      'rgba(59, 130, 246, 0.8)',   // Blue - Primary
      'rgba(16, 185, 129, 0.8)',   // Emerald - Success
      'rgba(245, 158, 11, 0.8)',   // Amber - Warning
      'rgba(239, 68, 68, 0.8)',    // Red - Error
      'rgba(139, 92, 246, 0.8)',   // Purple - Info
      'rgba(236, 72, 153, 0.8)',   // Pink - Secondary
      'rgba(14, 165, 233, 0.8)',   // Sky - Light Blue
      'rgba(34, 197, 94, 0.8)',    // Green - Success Alt
      'rgba(168, 85, 247, 0.8)',   // Violet - Purple Alt
      'rgba(251, 146, 60, 0.8)',   // Orange - Warning Alt
      'rgba(6, 182, 212, 0.8)',    // Cyan - Info Alt
      'rgba(244, 63, 94, 0.8)',    // Rose - Error Alt
    ];

    // Generate additional colors if needed
    const result = [];
    for (let i = 0; i < count; i++) {
      if (i < colors.length) {
        result.push(colors[i]);
      } else {
        // Generate additional colors using HSL
        const hue = (i * 137.508) % 360; // Golden angle for even distribution
        result.push(`hsla(${hue}, 70%, 60%, 0.8)`);
      }
    }
    
    return result;
  }

  /**
   * Get text color based on current theme
   */
  private getTextColor(): string {
    // Check if dark mode is active
    const isDark = document.body.classList.contains('app-dark') || 
                   document.documentElement.classList.contains('app-dark');
    
    return isDark ? '#e2e8f0' : '#1f2937';
  }

  /**
   * Get tooltip background color based on current theme
   */
  private getTooltipBackgroundColor(): string {
    const isDark = document.body.classList.contains('app-dark') || 
                   document.documentElement.classList.contains('app-dark');
    
    return isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  }

  /**
   * Get border color based on current theme
   */
  private getBorderColor(): string {
    const isDark = document.body.classList.contains('app-dark') || 
                   document.documentElement.classList.contains('app-dark');
    
    return isDark ? '#374151' : '#e5e7eb';
  }

  /**
   * Get metrics summary for display
   */
  public getMetricsSummary(data: any[]): {
    totalRows: number;
    rowsWithMetrics: number;
    uniqueMetricLabels: number;
    totalMetricValue: number;
  } {
    if (!data?.length) {
      return {
        totalRows: 0,
        rowsWithMetrics: 0,
        uniqueMetricLabels: 0,
        totalMetricValue: 0
      };
    }

    const metricsMap = new Map<string, number>();
    let rowsWithMetrics = 0;
    let totalMetricValue = 0;

    for (const row of data) {
      const value = this.getNestedValue(row, '_source.metrics.value');
      const label = this.getNestedValue(row, '_source.metrics.label');
      
      if (value !== null && label) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          rowsWithMetrics++;
          totalMetricValue += numValue;
          const labelStr = String(label);
          metricsMap.set(labelStr, (metricsMap.get(labelStr) || 0) + numValue);
        }
      }
    }

    return {
      totalRows: data.length,
      rowsWithMetrics,
      uniqueMetricLabels: metricsMap.size,
      totalMetricValue
    };
  }

  /**
   * Check if data contains valid metrics
   */
  public hasValidMetrics(data: any[]): boolean {
    if (!data?.length) {
      return false;
    }

    for (const row of data) {
      const value = this.getNestedValue(row, '_source.metrics.value');
      const label = this.getNestedValue(row, '_source.metrics.label');
      
      if (value !== null && label) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get top N metrics by value
   */
  public getTopMetrics(data: any[], topN: number = 5): Array<{label: string, value: number, percentage: number}> {
    const metricsData = this.calculateMetrics(data);
    if (!metricsData) {
      return [];
    }

    const { labels, datasets } = metricsData.chartData;
    const values = datasets[0].data;
    const total = values.reduce((sum: number, val: number) => sum + val, 0);

    // Combine labels and values, then sort by value
    const combined = labels.map((label: string, index: number) => ({
      label,
      value: values[index],
      percentage: (values[index] / total) * 100
    }));

    return combined
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
  }

  /**
   * Export metrics data as CSV
   */
  public exportMetricsAsCSV(data: any[]): string {
    const metricsData = this.calculateMetrics(data);
    if (!metricsData) {
      return 'Label,Value,Percentage\nNo metrics data available,0,0';
    }

    const { labels, datasets } = metricsData.chartData;
    const values = datasets[0].data;
    const total = values.reduce((sum: number, val: number) => sum + val, 0);

    let csv = 'Label,Value,Percentage\n';
    
    labels.forEach((label: string, index: number) => {
      const value = values[index];
      const percentage = ((value / total) * 100).toFixed(2);
      csv += `"${label}",${value},${percentage}%\n`;
    });

    return csv;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return null;

    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }
}