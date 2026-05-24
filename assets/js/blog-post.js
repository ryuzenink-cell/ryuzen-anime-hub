const blogPostRoot = document.getElementById("blogPostRoot");
const relatedPostsRoot = document.getElementById("relatedPosts");

if (document.body.dataset.blogPrerendered !== "true") initBlogPostPage();

async function initBlogPostPage() {
  renderPostLoading();

  const postPath = getCurrentBlogPostPath();
  if (!postPath) {
    renderEmpty(blogPostRoot, "Post não encontrado", "Abra um post pela página do blog.", `<a class="btn primary" href="${RYZEN_ROUTES.blog}">Voltar ao blog</a>`);
    return;
  }

  try {
    const markdown = await fetchText(postPath);
    const post = parseBlogFrontMatter(markdown, postPath);
    const cleanUrl = blogPostCleanUrl(post.path);
    document.title = `${post.title} | Ryuzen Anime Hub`;
    updatePostSeoTags(post, cleanUrl);
    renderPost(post);
    renderRelatedPosts(post);
  } catch (error) {
    console.error(error);
    renderError(blogPostRoot, "Não foi possível carregar este post. Verifique se o arquivo Markdown existe no caminho informado.");
  }
}

function getCurrentBlogPostPath() {
  const params = new URLSearchParams(location.search);
  const queryPostPath = normalizeBlogPath(params.get("post") || "");

  if (isValidBlogPostPath(queryPostPath)) {
    const cleanUrl = blogPostCleanUrl(queryPostPath);
    if (cleanUrl && `${location.pathname}${location.search}` !== cleanUrl) {
      window.location.replace(cleanUrl);
      return "";
    }
    return queryPostPath;
  }

  const cleanPostPath = blogPostPathFromCleanUrl(location.pathname);
  return isValidBlogPostPath(cleanPostPath) ? cleanPostPath : "";
}

function isValidBlogPostPath(path = "") {
  const normalized = normalizeBlogPath(path);
  return normalized.startsWith("blog/") && normalized.endsWith(".md");
}

function updatePostSeoTags(post, cleanUrl) {
  const canonicalUrl = absoluteBlogPostUrl(cleanUrl || blogPostCleanUrl(post.path));
  const description = post.description || post.excerpt || "Artigo editorial do Ryuzen Anime Hub.";

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute("content", description);

  upsertCanonical(canonicalUrl);
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("name", "twitter:url", canonicalUrl);
  upsertMeta("property", "og:title", post.title);
  upsertMeta("name", "twitter:title", post.title);
  upsertMeta("property", "og:description", description);
  upsertMeta("name", "twitter:description", description);
  if (post.cover) upsertMeta("property", "og:image", safeUrl(post.cover, ""));
}

function absoluteBlogPostUrl(cleanUrl = "") {
  try {
    return new URL(cleanUrl, window.location.origin).href;
  } catch {
    return cleanUrl;
  }
}

function upsertCanonical(href) {
  if (!href) return;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
}

function upsertMeta(attributeName, attributeValue, content) {
  if (!content) return;
  let meta = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attributeName, attributeValue);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function renderPostLoading() {
  if (!blogPostRoot) return;
  blogPostRoot.innerHTML = `
    <article class="blog-article panel">
      <div class="skeleton skeleton-eyebrow"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-subtitle"></div>
      <div class="skeleton-text-block">
        <div class="skeleton skeleton-line long"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line medium"></div>
      </div>
    </article>`;
}

function renderPost(post) {
  blogPostRoot.innerHTML = `
    <article class="blog-article panel">
      <nav class="blog-breadcrumb" aria-label="Caminho do post">
        <a href="${RYZEN_ROUTES.home}">Home</a>
        <span>/</span>
        <a href="${RYZEN_ROUTES.blog}">Blog</a>
        <span>/</span>
        <span>${escapeHtml(post.category)}</span>
      </nav>
      ${renderArticleCover(post)}
      <header class="blog-article-header">
        <p class="eyebrow">${escapeHtml(post.category)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.description)}</p>
        <div class="meta-line blog-card-meta">
          <span>Publicado em ${escapeHtml(formatBlogDate(post.date))}</span>
          ${post.updated && post.updated !== post.date ? `<span>Atualizado em ${escapeHtml(formatBlogDate(post.updated))}</span>` : ""}
          <span>${escapeHtml(post.author)}</span>
          <span>${post.readingTime} min de leitura</span>
        </div>
        ${post.tags.length ? `<div class="blog-tag-list">${post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      </header>
      <div class="blog-content">
        ${renderMarkdown(post.content)}
      </div>
    </article>`;
}

async function renderRelatedPosts(currentPost) {
  if (!relatedPostsRoot) return;
  try {
    const posts = await loadBlogPosts();
    const related = posts
      .filter((post) => post.path !== currentPost.path)
      .filter((post) => post.category === currentPost.category || post.tags.some((tag) => currentPost.tags.includes(tag)))
      .slice(0, 3);

    if (!related.length) {
      relatedPostsRoot.innerHTML = "";
      return;
    }

    relatedPostsRoot.innerHTML = `
      <section class="section compact-section">
        <div class="section-head"><div><p class="eyebrow">Continue lendo</p><h2>Posts relacionados</h2></div></div>
        <div class="blog-grid">
          ${related.map((post) => `
            <article class="blog-card">
              <div class="blog-card-body">
                <span class="badge warn">${escapeHtml(post.category)}</span>
                <h3>${escapeHtml(post.title)}</h3>
                <p>${escapeHtml(post.excerpt)}</p>
              </div>
              <div class="blog-card-footer">
                <span>${post.readingTime} min</span>
                <a class="btn ghost" href="${escapeHtml(blogPostCleanUrl(post.path))}">Abrir</a>
              </div>
            </article>
          `).join("")}
        </div>
      </section>`;
  } catch (error) {
    relatedPostsRoot.innerHTML = "";
  }
}

function renderArticleCover(post) {
  if (!post.cover) return "";
  const cover = safeUrl(post.cover, "");
  if (!cover) return "";
  return `<img class="blog-article-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(post.coverAlt || `Imagem de capa do post ${post.title}`)}" loading="eager" fetchpriority="high" decoding="async">`;
}
