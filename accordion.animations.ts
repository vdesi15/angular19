// animations/accordion.animations.ts
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';

export const accordionAnimations = {
  slideToggle: trigger('slideToggle', [
    state('collapsed', style({
      height: '0px',
      // Remove overflow: 'hidden' - this causes the animation warning
    })),
    state('expanded', style({
      height: '*',
      // Remove overflow: 'hidden'
    })),
    transition('collapsed <=> expanded', [
      animate('300ms cubic-bezier(0.4, 0, 0.2, 1)')
    ])
  ]),

  iconRotate: trigger('iconRotate', [
    state('collapsed', style({
      transform: 'rotate(0deg)'
    })),
    state('expanded', style({
      transform: 'rotate(180deg)'
    })),
    transition('collapsed <=> expanded', [
      animate('300ms cubic-bezier(0.4, 0, 0.2, 1)')
    ])
  ]),

  fadeInContent: trigger('fadeInContent', [
    state('void', style({
      opacity: 0
    })),
    state('*', style({
      opacity: 1
    })),
    transition('void => *', [
      animate('200ms 100ms ease-in')
    ])
  ])
};