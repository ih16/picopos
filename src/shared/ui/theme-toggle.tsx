import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { Button } from './controls';
import { Icon } from './icon';

export const ThemeToggle = component$(() => {
  const dark = useSignal(false);
  useVisibleTask$(
    ({ cleanup }) => {
      const update = () => {
        dark.value = document.documentElement.dataset.theme === 'dark';
      };
      update();
      const observer = new MutationObserver(update);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      cleanup(() => observer.disconnect());
    },
    { strategy: 'document-ready' },
  );

  return (
    <Button
      class="secondary theme-toggle"
      aria-label="Night mode"
      aria-pressed={dark.value}
      title={dark.value ? 'Switch to day mode' : 'Switch to night mode'}
      onClick$={() => {
        dark.value = !dark.value;
        const theme = dark.value ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute('content', dark.value ? '#151922' : '#e8eaee');
        try {
          localStorage.setItem('picopos.theme', theme);
        } catch {
          /* Keep the theme for this visit when storage is unavailable. */
        }
      }}
    >
      <Icon name={dark.value ? 'sun' : 'moon'} />
    </Button>
  );
});
