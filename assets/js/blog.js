const blogState = {
  posts: [],
  search: "",
  category: "Todos",
};

const blogGrid = document.getElementById("blogGrid");
const blogCategories = document.getElementById("blogCategories");
const blogSearch = document.getElementById("blogSearch");
const blogFeatured = document.getElementById("blogFeatured");

initBlogPage();

async function initBlogPage() {
  renderBlogLoading();

  try {
    blogState.posts = await loadBlogPosts();
    renderBlogFeatured();
    renderBlogCategories();
    renderBlogPosts();
    bindBlogSearch();
  } catch (error) {
    console.error(error);
    renderError(blogGrid, "Não foi possível carregar os posts do blog agora.");
  }
}

function renderBlogLoading() {
  if (blogFeatured) {
    blogFeatured.innerHTML = `
      <div class="blog-featured-card">
        <div class="skeleton skeleton-blog-featured"></div>
      </div>`;
  }
  if (blogGrid) renderLoading(blogGrid, 6);
}

function renderBlogFeatured() {
  if (!blogFeatured) return;
  const post = blogState.posts[0];
  if (!post) {
    blogFeatured.innerHTML = "";
    return;
  }

  blogFeatured.innerHTML = `
    <article class="blog-featured-card">
      <div>
        <p class="eyebrow">Post em destaque</p>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="meta-line blog-card-meta">
          <span>${escapeHtml(formatBlogDate(post.date))}</span>
          <span>${escapeHtml(post.category)}</span>
          <span>${post.readingTime} min de leitura</span>
        </div>
      </div>
      <a class="btn primary" href="${routeWithQuery(RYZEN_ROUTES.blogPost, { post: post.path })}">Ler post</a>
    </article>`;
}

function renderBlogCategories() {
  if (!blogCategories) return;
  const categories = ["Todos", ...new Set(blogState.posts.map((post) => post.category).filter(Boolean))];
  blogCategories.innerHTML = categories.map((category) => `
    <button class="chip ${category === blogState.category ? "active" : ""}" type="button" data-blog-category="${escapeHtml(category)}">
      ${escapeHtml(category)}
    </button>
  `).join("");

  blogCategories.querySelectorAll("[data-blog-category]").forEach((button) => {
    button.addEventListener("click", () => {
      blogState.category = button.dataset.blogCategory;
      renderBlogCategories();
      renderBlogPosts();
    });
  });
}

function bindBlogSearch() {
  if (!blogSearch) return;
  blogSearch.addEventListener("input", () => {
    blogState.search = blogSearch.value.trim().toLowerCase();
    renderBlogPosts();
  });
}

function getFilteredBlogPosts() {
  return blogState.posts.filter((post) => {
    const matchesCategory = blogState.category === "Todos" || post.category === blogState.category;
    const searchable = [post.title, post.excerpt, post.category, post.tags.join(" ")].join(" ").toLowerCase();
    const matchesSearch = !blogState.search || searchable.includes(blogState.search);
    return matchesCategory && matchesSearch;
  });
}

function renderBlogPosts() {
  if (!blogGrid) return;
  const posts = getFilteredBlogPosts();

  if (!posts.length) {
    renderEmpty(blogGrid, "Nenhum post encontrado", "Tente outra busca ou selecione outra categoria.");
    return;
  }

  blogGrid.innerHTML = posts.map((post) => `
    <article class="blog-card">
      ${renderBlogCardCover(post)}
      <div class="blog-card-body">
        <div class="blog-card-topline">
          <span class="badge warn">${escapeHtml(post.category)}</span>
          <span>${escapeHtml(formatBlogDate(post.date))}</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="blog-tag-list">
          ${post.tags.slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <div class="blog-card-footer">
        <span>${post.readingTime} min de leitura</span>
        <a class="btn ghost" href="${routeWithQuery(RYZEN_ROUTES.blogPost, { post: post.path })}">Abrir</a>
      </div>
    </article>
  `).join("");
}

function renderBlogCardCover(post) {
  if (!post.cover) return "";
  const cover = safeUrl(post.cover, "");
  if (!cover) return "";
  return `<img class="blog-card-cover" src="${escapeHtml(cover)}" alt="Imagem de capa do post ${escapeHtml(post.title)}" loading="lazy">`;
}
