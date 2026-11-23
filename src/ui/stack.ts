import { ChevronLeft } from 'lucide';
import { el, icon } from './dom';
import { pressable } from './press';
import { EASE_IOS, reduced } from './sheet';

export interface Page {
  el: HTMLElement;
  className?: string;
  refresh?(): void;
  mounted?(): void;
}

export interface Stack {
  el: HTMLElement;
  push(page: Page): void;
  pop(): void;
}

const SLIDE = 350;

export function pageHeader(title: string, onBack: () => void, titleClass = ''): HTMLElement {
  const header = el('div', 'page-header');
  const back = el('button', 'back-btn');
  back.type = 'button';
  back.dataset.action = 'back';
  back.setAttribute('aria-label', 'Back');
  back.append(icon(ChevronLeft));
  pressable(back);
  back.addEventListener('click', onBack);
  header.append(back, el('div', `page-title ${titleClass}`.trim(), title));
  return header;
}

export function createStack(root: Page): Stack {
  const container = el('div', 'stack');
  const entries: { page: Page; wrap: HTMLElement }[] = [];
  let busy = false;

  const mount = (page: Page) => {
    const wrap = el('div', `stack-page ${page.className ?? ''}`.trim());
    wrap.append(page.el);
    container.append(wrap);
    entries.push({ page, wrap });
    page.mounted?.();
    return wrap;
  };

  const run = (
    outgoing: HTMLElement,
    outFrames: Keyframe[],
    incoming: HTMLElement,
    inFrames: Keyframe[],
    done: () => void,
  ) => {
    busy = true;
    const finish = () => {
      busy = false;
      done();
    };
    if (reduced()) {
      finish();
      return;
    }
    outgoing.animate(outFrames, { duration: SLIDE, easing: EASE_IOS });
    incoming.animate(inFrames, { duration: SLIDE, easing: EASE_IOS }).finished.then(finish, finish);
  };

  mount(root);

  return {
    el: container,
    push(page) {
      if (busy) return;
      const below = entries[entries.length - 1].wrap;
      const wrap = mount(page);
      run(
        below,
        [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-25%)', opacity: 0 }],
        wrap,
        [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
        () => {
          below.style.visibility = 'hidden';
        },
      );
    },
    pop() {
      if (busy || entries.length < 2) return;
      const top = entries[entries.length - 1];
      const below = entries[entries.length - 2];
      below.wrap.style.visibility = 'visible';
      below.page.refresh?.();
      run(
        below.wrap,
        [{ transform: 'translateX(-25%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
        top.wrap,
        [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
        () => {
          top.wrap.remove();
          entries.pop();
        },
      );
    },
  };
}
