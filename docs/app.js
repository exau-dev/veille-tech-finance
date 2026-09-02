(function () {
  "use strict";

  const state = {
    articles: [],
    category: "all",
    source: "all",
    query: "",
  };

  const els = {
    lastUpdated: document.getElementById("last-updated"),
    searchInput: document.getElementById("search-input"),
    categoryFilters: document.getElementById("category-filters"),
    sourceFilter: document.getElementById("source-filter"),
    articleList: document.getElementById("article-list"),
    emptyState: document.getElementById("empty-state"),
  };

  const CATEGORY_LABELS = { tech: "Tech", finance: "Finance" };

  function formatRelativeDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 7) return `il y a ${diffD} j`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }

  function populateSourceFilter(articles) {
    const sources = Array.from(new Set(articles.map((a) => a.source))).sort((a, b) =>
      a.localeCompare(b, "fr")
    );
    for (const source of sources) {
      const option = document.createElement("option");
      option.value = source;
      option.textContent = source;
      els.sourceFilter.appendChild(option);
    }
  }

  function matchesFilters(article) {
    if (state.category !== "all" && article.category !== state.category) return false;
    if (state.source !== "all" && article.source !== state.source) return false;
    if (state.query) {
      const haystack = `${article.title} ${article.summary}`.toLowerCase();
      if (!haystack.includes(state.query)) return false;
    }
    return true;
  }

  function render() {
    const filtered = state.articles.filter(matchesFilters);
    els.articleList.innerHTML = "";
    els.emptyState.hidden = filtered.length !== 0;

    const fragment = document.createDocumentFragment();
    for (const article of filtered) {
      const li = document.createElement("li");
      li.className = "article-card";

      const badgeClass = article.category === "finance" ? "badge-finance" : "badge-tech";
      const badgeLabel = CATEGORY_LABELS[article.category] || article.category;

      li.innerHTML = `
        <div class="article-card-top">
          <span class="badge ${badgeClass}">${badgeLabel}</span>
          <span class="article-source">${escapeHtml(article.source)}</span>
          <span class="article-date">${formatRelativeDate(article.published)}</span>
        </div>
        <h2><a href="${escapeAttr(article.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        article.title
      )}</a></h2>
        <p class="article-summary">${escapeHtml(article.summary)}</p>
      `;
      fragment.appendChild(li);
    }
    els.articleList.appendChild(fragment);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || "").replace(/"/g, "&quot;");
  }

  function setupControls() {
    els.searchInput.addEventListener("input", (e) => {
      state.query = e.target.value.trim().toLowerCase();
      render();
    });

    els.categoryFilters.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      state.category = btn.dataset.category;
      els.categoryFilters
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.toggle("active", b === btn));
      render();
    });

    els.sourceFilter.addEventListener("change", (e) => {
      state.source = e.target.value;
      render();
    });
  }

  async function init() {
    setupControls();
    try {
      const response = await fetch("data/articles.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.articles = data.articles || [];

      if (data.generated_at) {
        const generated = new Date(data.generated_at);
        els.lastUpdated.textContent = `${state.articles.length} articles · mis à jour le ${generated.toLocaleString(
          "fr-FR"
        )}`;
      } else {
        els.lastUpdated.textContent =
          "Aucune donnée pour le moment — lancez scripts/fetch_feeds.py ou attendez le prochain run automatique.";
      }

      populateSourceFilter(state.articles);
      render();
    } catch (err) {
      els.lastUpdated.textContent = "Impossible de charger les actualités.";
      console.error("Failed to load articles.json", err);
    }
  }

  init();
})();
