import { createMemo, createSignal, For } from 'solid-js';

import { Button, Input, Panel } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ThemeToggle } from '../../shared/ui/theme-toggle';
import { HELP_TOPICS } from './help-content';

export function Help() {
  const [search, setSearch] = createSignal('');
  const [topic, setTopic] = createSignal('all');
  const query = createMemo(() => search().trim().toLowerCase());
  const sections = createMemo(() =>
    HELP_TOPICS.filter((section) => topic() === 'all' || section.id === topic())
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
            .includes(query()),
        ),
      }))
      .filter((section) => section.articles.length),
  );
  const count = createMemo(() => sections().reduce((total, section) => total + section.articles.length, 0));
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
            value={search()}
            onInput={(event) => {
              const input = event.currentTarget;
              setSearch(input.value);
              setTopic('all');
            }}
          />
        </label>
        <ThemeToggle />
      </header>
      <div class="help-layout help-document-body">
        <label class="help-topic-picker">
          <span class="sr-only">Help topic</span>
          <select
            value={topic()}
            onChange={(event) => {
              const select = event.currentTarget;
              setTopic(select.value);
              setSearch('');
            }}
          >
            <option value="all">All features</option>
            {HELP_TOPICS.map((section) => (
              <option value={section.id}>{section.title}</option>
            ))}
          </select>
        </label>
        <nav class="help-topics" aria-label="Help topics">
          <Button
            unstyled
            class={['nav-item', topic() === 'all' && 'selected']}
            aria-pressed={topic() === 'all' ? 'true' : 'false'}
            onClick={() => {
              setTopic('all');
              setSearch('');
            }}
          >
            All features
          </Button>
          {HELP_TOPICS.map((section) => (
            <Button
              unstyled
              class={['nav-item', topic() === section.id && 'selected']}
              aria-pressed={topic() === section.id ? 'true' : 'false'}
              onClick={() => {
                setTopic(section.id);
                setSearch('');
              }}
            >
              {section.title}
            </Button>
          ))}
        </nav>
        <main class="help-content">
          <header class="help-header">
            <div>
              <h1>Shop help</h1>
            </div>
          </header>
          <p class="muted help-result-count" role="status">
            {count()} guides · {sections().length} topics
          </p>
          <For each={sections()}>
            {(section) => (
              <Panel class="help-section stack">
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
                    <details class="help-article" open={Boolean(query()) || topic() !== 'all'}>
                      <summary>{article.title}</summary>
                      <div class="help-article-body">
                        {article.steps && (
                          <ol>
                            {article.steps.map((step) => (
                              <li>{step}</li>
                            ))}
                          </ol>
                        )}
                        {article.paragraphs?.map((paragraph) => (
                          <p>{paragraph}</p>
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
            )}
          </For>
          {!sections().length && (
            <Panel class="empty">
              No guides match “{search()}”. Try a feature name such as stock, returns, or sync.
            </Panel>
          )}
        </main>
      </div>
    </div>
  );
}
