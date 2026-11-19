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
          ...(article.example?.frames.map((frame) => frame.caption) ?? []),
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
            placeholder="Search features, workflows, or questions"
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
              <h1>Help & documentation</h1>
              <p class="muted">A guide to every part of your shop, from first setup to daily sales.</p>
              <p class="muted help-capture-note">
                Watch & follow guides include captioned videos made from browser screenshots and illustrated
                steps. Captured in the fictional demo shop on 19 November 2026. Google sign-in, sharing, live
                sync, and offline recovery are written guides only.
              </p>
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
                        <div class="help-example">
                          <video
                            controls
                            playsInline
                            preload="none"
                            poster={`/help/examples/${article.example.frames[0].image}.jpg`}
                            aria-label={article.example.title}
                          >
                            <source src={`/help/examples/${article.example.id}.mp4`} type="video/mp4" />
                            <track
                              kind="captions"
                              src={`/help/examples/${article.example.id}.vtt`}
                              srclang="en"
                              label="English steps"
                              default
                            />
                            Your browser does not support video. Follow the illustrated steps below.
                          </video>
                          <p class="muted">
                            Silent step-by-step video · pause at any point. Select a screenshot to enlarge it.
                          </p>
                          <ol class="help-example-steps">
                            {article.example.frames.map((frame) => (
                              <li key={frame.image}>
                                <p>{frame.caption}</p>
                                <a href={`/help/examples/${frame.image}.jpg`} target="_blank" rel="noopener">
                                  <img
                                    src={`/help/examples/${frame.image}.jpg`}
                                    alt={frame.caption}
                                    loading="lazy"
                                    decoding="async"
                                    width={1440}
                                    height={900}
                                  />
                                </a>
                              </li>
                            ))}
                          </ol>
                        </div>
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
