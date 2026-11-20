import { createSignal, onSettled } from 'solid-js';

import { Button } from './controls';
import { Icon } from './icon';

export function ThemeToggle() {
  const [dark, setDark] = createSignal(false);
  onSettled(() => {
    const update = () => {
      setDark(document.documentElement.dataset.theme === 'dark');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  return (
    <Button
      class="secondary theme-toggle"
      aria-label="Night mode"
      aria-pressed={dark() ? 'true' : 'false'}
      title={dark() ? 'Switch to day mode' : 'Switch to night mode'}
      onClick={() => {
        const theme = dark() ? 'light' : 'dark';
        document.documentElement.dataset.theme = theme;
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute('content', theme === 'dark' ? '#151922' : '#e8eaee');
        try {
          localStorage.setItem('picopos.theme', theme);
        } catch {
          /* Keep the theme for this visit when storage is unavailable. */
        }
      }}
    >
      <Icon name={dark() ? 'sun' : 'moon'} />
    </Button>
  );
}
