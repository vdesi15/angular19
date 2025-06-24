// src/app/theme/custom-preset.ts
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const CustomPreset = definePreset(Aura, {
  semantic: {
    // Primary color remains default (emerald) - you can change this if needed
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}'
    },
    
    // Custom color scheme for light/dark modes
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712'
        }
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#1e1e1e',
          100: '#2a2a2a',
          200: '#363636',
          300: '#404040',
          400: '#525252',
          500: '#737373',
          600: '#a3a3a3',
          700: '#d4d4d4',
          800: '#e5e5e5',
          900: '#f5f5f5',
          950: '#fafafa'
        }
      }
    }
  },
  
  components: {
    // Accordion customization using your specified colors
    accordion: {
      panel: {
        borderWidth: '1px',
        borderColor: '{surface.300}'
      },
      header: {
        color: '{text.color}',
        borderWidth: '1px',
        borderColor: '{surface.300}',
        background: '#f7f7f7', // Your specified light mode color
        hoverBackground: '#e5e5e5',
        borderRadius: '6px'
      },
      content: {
        background: '#f7f7f7', // Your specified light mode color
        color: '{text.color}',
        borderWidth: '1px',
        borderColor: '{surface.300}',
        borderRadius: '6px'
      },
      colorScheme: {
        dark: {
          header: {
            background: '#2a2a2a', // Your specified dark mode color
            hoverBackground: '#1e1e1e',
            color: '{text.color}'
          },
          content: {
            background: '#2a2a2a', // Your specified dark mode color
            color: '{text.color}'
          }
        }
      }
    },
    
    // Toolbar customization using your specified blue color
    toolbar: {
      background: '#0171c5', // Your specified toolbar color
      borderColor: '#0171c5',
      color: '#ffffff',
      gap: '0.5rem',
      padding: '0.75rem 1rem'
    },
    
    // DataTable customization for gridlines
    datatable: {
      header: {
        cell: {
          borderColor: '#CDCDCD', // Your specified gridline color
          borderWidth: '1px'
        }
      },
      body: {
        cell: {
          borderColor: '#CDCDCD', // Your specified gridline color
          borderWidth: '1px'
        }
      },
      colorScheme: {
        dark: {
          header: {
            cell: {
              borderColor: '#404040' // Dark mode gridline color
            }
          },
          body: {
            cell: {
              borderColor: '#404040' // Dark mode gridline color
            }
          }
        }
      }
    },
    
    // Button customizations for toolbar
    button: {
      colorScheme: {
        dark: {
          text: {
            primary: {
              color: '#ffffff'
            }
          }
        }
      }
    },
    
    // Input customizations for proper sizing
    inputtext: {
      paddingX: '0.5rem',
      paddingY: '0.375rem',
      fontSize: '0.875rem'
    },
    
    // Dropdown customizations for toolbar
    dropdown: {
      colorScheme: {
        dark: {
          background: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          color: '#ffffff'
        }
      }
    },
    
    // MultiSelect customizations for toolbar  
    multiselect: {
      colorScheme: {
        dark: {
          background: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          color: '#ffffff'
        }
      }
    }
  }
});