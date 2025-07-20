// animations/accordion.animations.ts
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';

export const accordionAnimations = {
  // Main slide down/up animation
  slideToggle: trigger('slideToggle', [
    state('collapsed', style({
      height: '0px',
      minHeight: '0',
      overflow: 'hidden',
      opacity: 0
    })),
    state('expanded', style({
      height: '*',
      overflow: 'visible',
      opacity: 1
    })),
    transition('collapsed <=> expanded', [
      animate('350ms cubic-bezier(0.25, 0.8, 0.25, 1)')
    ])
  ]),

  // Icon rotation animation
  iconRotate: trigger('iconRotate', [
    state('collapsed', style({
      transform: 'rotate(0deg)'
    })),
    state('expanded', style({
      transform: 'rotate(90deg)'
    })),
    transition('collapsed <=> expanded', [
      animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)')
    ])
  ]),

  // Fade in content animation
  fadeInContent: trigger('fadeInContent', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(-10px)' }),
      animate('400ms 150ms cubic-bezier(0.25, 0.8, 0.25, 1)', 
        style({ opacity: 1, transform: 'translateY(0)' })
      )
    ]),
    transition(':leave', [
      animate('200ms cubic-bezier(0.25, 0.8, 0.25, 1)', 
        style({ opacity: 0, transform: 'translateY(-10px)' })
      )
    ])
  ]),

  // Header hover animation
  headerHover: trigger('headerHover', [
    state('normal', style({
      transform: 'scale(1)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    })),
    state('hovered', style({
      transform: 'scale(1.01)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)'
    })),
    transition('normal <=> hovered', [
      animate('200ms cubic-bezier(0.25, 0.8, 0.25, 1)')
    ])
  ]),

  // Stagger animation for multiple accordion items
  staggerItems: trigger('staggerItems', [
    transition('* => *', [
      animate('1ms', keyframes([
        style({ opacity: 1 })
      ]))
    ])
  ])
};