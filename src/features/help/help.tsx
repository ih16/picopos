import { component$, useSignal } from '@builder.io/qwik';
import { ThemeToggle } from '../../shared/ui/theme-toggle';
import { Button, Input, Panel } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { HELP_TOPICS } from './help-content';

export const Help = component$(() => {
  const search = useSignal('');
  const topic = useSignal('all');
  const query = search.value.trim().toLowerCase();
  const sections = HELP_TOPICS.filter((section) => topic.value === 'all' || section.id === topic.value)
    .map((section) => ({
      ...section,
      articles: section.articles.filter((article) =>
        [
          section.title,
          section.description,
          article.title,
          ...(article.paragraphs ?? []),
          ...(article.steps ?? []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      ),
    }))
    .filter((section) => section.articles.length);
  const count = sections.reduce((total, section) => total + section.articles.length, 0);
  return (
    <div class="workspace help-document">
      <header class="topbar help-topbar">
        <a href="/" class="brand" aria-label="picopos home">
          <span class="brand-mark" aria-hidden="true" />
          <span class="brand-wordmark">
            pico<span>pos</span>
          </span>
        </a>
        <label class="help-search">
          <span class="sr-only">Search help</span>
          <Icon name="search" />
          <Input
            type="search"
            placeholder="Search help"
            value={search.value}
            onInput$={(_, input) => {
              search.value = input.value;
              topic.value = 'all';
            }}
          />
        </label>
        <ThemeToggle />
      </header>
      <div class="help-layout help-document-body">
        <label class="help-topic-picker">
          <span class="sr-only">Help topic</span>
          <select
            value={topic.value}
            onChange$={(_, select) => {
              topic.value = select.value;
              search.value = '';
            }}
          >
            <option value="all">All features</option>
            {HELP_TOPICS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>
        <nav class="help-topics" aria-label="Help topics">
          <Button
            unstyled
            class={['nav-item', topic.value === 'all' && 'selected']}
            aria-pressed={topic.value === 'all'}
            onClick$={() => {
              topic.value = 'all';
              search.value = '';
            }}
          >
            All features
          </Button>
          {HELP_TOPICS.map((section) => (
            <Button
              key={section.id}
              unstyled
              class={['nav-item', topic.value === section.id && 'selected']}
              aria-pressed={topic.value === section.id}
              onClick$={() => {
                topic.value = section.id;
                search.value = '';
              }}
            >
              {section.title}
            </Button>
          ))}
        </nav>
        <main class="help-content" key={`${topic.value}-${query}`}>
          <header class="help-header">
            <div>
              <h1>Shop help</h1>
            </div>
          </header>
          <p class="muted help-result-count" role="status">
            {count} guides · {sections.length} topics
          </p>
          {sections.map((section) => (
            <Panel class="help-section stack" key={section.id}>
              <div class="panel-heading">
                <div>
                  <h2>{section.title}</h2>
                  <p class="muted">{section.description}</p>
                </div>
                <a class="button secondary compact" href={`/#${section.path}`}>
                  Open {section.screen}
                  <Icon name="arrow-right" />
                </a>
              </div>
              <div class="help-articles">
                {section.articles.map((article) => (
                  <details
                    key={article.title}
                    class="help-article"
                    open={Boolean(query) || topic.value !== 'all'}
                  >
                    <summary>{article.title}</summary>
                    <div class="help-article-body">
                      {article.steps && (
                        <ol>
                          {article.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      )}
                      {article.paragraphs?.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {article.example && (
                        <img
                          class="help-example"
                          src={`/help/examples/${article.example}.gif`}
                          alt={article.title}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </Panel>
          ))}
          {!sections.length && (
            <Panel class="empty">
              No guides match “{search.value}”. Try a feature name such as stock, returns, or sync.
            </Panel>
          )}
        </main>
      </div>
    </div>
  );
});
