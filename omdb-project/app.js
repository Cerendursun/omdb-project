const apiKey = "f008e8e2";

const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const recentSearchList = document.getElementById("recentSearchList");
const searchHistoryInline = document.getElementById("searchHistoryInline");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const movieContainer = document.getElementById("movieContainer");
const recentContainer = document.getElementById("recentContainer");
const trendingContainer = document.getElementById("trendingContainer");
const genreFilter = document.getElementById("genreFilter");
const typeFilter = document.getElementById("typeFilter");
const yearFilter = document.getElementById("yearFilter");
const ratingFilter = document.getElementById("ratingFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const statusText = document.getElementById("statusText");
const featuredTitle = document.getElementById("featuredTitle");
const featuredMeta = document.getElementById("featuredMeta");
const featuredPlot = document.getElementById("featuredPlot");
const playFeaturedBtn = document.getElementById("playFeaturedBtn");
const infoFeaturedBtn = document.getElementById("infoFeaturedBtn");

let moviesData = [];
let timeout;
let movieDetailCache = {};
let featuredMovie = null;
let currentBackground = "";

// TRENDING
const trending = ["Inception", "Interstellar", "The Matrix", "Avatar", "Titanic"];

// INIT
window.onload = () => {
  loadTrending();
  loadRecent();
  loadFeatured();
  hydrateSearchState();
  movieContainer.innerHTML = `<p class="empty-state">Search results will appear here.</p>`;
};

// SEARCH BUTTON
searchBtn.addEventListener("click", () => {
  searchMovies(searchInput.value);
});

genreFilter.addEventListener("change", () => {
  renderMovies();
});
typeFilter.addEventListener("change", () => {
  renderMovies();
});
yearFilter.addEventListener("change", () => {
  renderMovies();
});
ratingFilter.addEventListener("change", () => {
  renderMovies();
});

clearFiltersBtn.addEventListener("click", () => {
  genreFilter.value = "";
  typeFilter.value = "";
  yearFilter.value = "";
  ratingFilter.value = "";
  renderMovies();
});

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem("recent");
  localStorage.removeItem("lastSearch");
  searchInput.value = "";
  renderSearchHistoryUI([]);
  loadRecent();
  statusText.textContent = "Search history cleared.";
});

playFeaturedBtn.addEventListener("click", () => {
  if (!featuredMovie) return;
  openMovie(featuredMovie.Title);
});

infoFeaturedBtn.addEventListener("click", () => {
  if (!featuredMovie) return;
  openMovie(featuredMovie.Title);
});

// ENTER
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchMovies(searchInput.value);
});

// LIVE SEARCH (debounce)
searchInput.addEventListener("input", () => {
  clearTimeout(timeout);

  const value = searchInput.value.trim();

  if (value.length < 3) {
    statusText.textContent = "Live search starts after entering at least 3 characters.";
    return;
  }

  timeout = setTimeout(() => {
    searchMovies(value);
  }, 500);
});

// SEARCH MOVIES
async function searchMovies(name) {
  const query = name.trim();
  if (!query) {
    statusText.textContent = "Please enter a movie name.";
    return;
  }

  statusText.textContent = `Searching for "${query}"...`;
  renderSkeletonStrip(movieContainer, 8);

  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}`
    );

    const data = await res.json();

    if (data.Response === "False") {
      movieContainer.innerHTML = `<p class="empty-state">No results found.</p>`;
      statusText.textContent = "No matches found. Try another keyword.";
      return;
    }

    moviesData = data.Search;
    movieDetailCache = {};
    populateYearFilter(moviesData);
    renderMovies();

    statusText.textContent = `${moviesData.length} results listed.`;
    saveRecent(query);
  } catch (error) {
    movieContainer.innerHTML = `<p class="empty-state">Something went wrong. Please try again.</p>`;
    statusText.textContent = "Search could not be completed due to a connection issue.";
  }
}

// RENDER RESULTS
async function renderMovies() {
  const selectedGenre = genreFilter.value;
  const selectedType = typeFilter.value;
  const selectedYear = yearFilter.value;
  const minRating = ratingFilter.value ? Number(ratingFilter.value) : 0;

  let visibleMovies = moviesData.filter((m) => m.Poster !== "N/A");

  if (selectedType) {
    visibleMovies = visibleMovies.filter((m) => m.Type === selectedType);
  }

  if (selectedYear) {
    visibleMovies = visibleMovies.filter((m) => (m.Year || "").includes(selectedYear));
  }

  const requiresDetails = Boolean(selectedGenre || minRating);

  if (requiresDetails) {
    statusText.textContent = "Applying advanced filters...";
    const detailedMovies = await Promise.all(
      visibleMovies.map((movie) => getMovieDetail(movie.imdbID))
    );

    visibleMovies = detailedMovies.filter((m) => {
      const genres = (m.Genre || "")
        .split(",")
        .map((item) => item.trim().toLowerCase());
      const genreMatch = selectedGenre ? genres.includes(selectedGenre.toLowerCase()) : true;
      const rating = parseFloat(m.imdbRating);
      const ratingMatch = minRating ? !Number.isNaN(rating) && rating >= minRating : true;
      return m.Response !== "False" && m.Poster !== "N/A" && genreMatch && ratingMatch;
    });
  }

  if (!visibleMovies.length) {
    movieContainer.innerHTML = `<p class="empty-state">No results for this filter.</p>`;
    statusText.textContent = "No movies matched the selected filter.";
    return;
  }

  movieContainer.innerHTML = visibleMovies
    .map((m) => createMovieCard(m))
    .join("");
  const activeFilters = [];
  if (selectedGenre) activeFilters.push(`Genre: ${selectedGenre}`);
  if (selectedType) activeFilters.push(`Type: ${selectedType}`);
  if (selectedYear) activeFilters.push(`Year: ${selectedYear}`);
  if (minRating) activeFilters.push(`IMDb: ${minRating}+`);

  statusText.textContent = activeFilters.length
    ? `Showing ${visibleMovies.length} results (${activeFilters.join(" | ")}).`
    : `Showing ${visibleMovies.length} results.`;
}

// OPEN DETAIL
async function openMovie(title) {
  statusText.textContent = `Loading details for "${title}"...`;
  renderSkeletonStrip(movieContainer, 1);

  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}`
    );

    const data = await res.json();
    setDynamicBackground(data.Poster);

    movieContainer.innerHTML = `
      <div class="movie-detail">
        <img src="${data.Poster}" alt="${data.Title} afis" />
        <div>
          <h2>${data.Title}</h2>
          <p><b>Year:</b> ${data.Year}</p>
          <p><b>Genre:</b> ${data.Genre}</p>
          <p><b>Director:</b> ${data.Director}</p>
          <p><b>IMDB:</b> ${data.imdbRating}</p>
          <p>${data.Plot}</p>
        </div>
      </div>
    `;
    statusText.textContent = `Showing details for ${data.Title}.`;
  } catch (error) {
    movieContainer.innerHTML = `<p class="empty-state">Movie details could not be loaded.</p>`;
    statusText.textContent = "An error occurred while fetching movie details.";
  }
}

async function loadFeatured() {
  try {
    const pick = trending[Math.floor(Math.random() * trending.length)];
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(pick)}`
    );
    const movie = await res.json();

    if (movie.Response === "False") return;
    featuredMovie = movie;

    featuredTitle.textContent = movie.Title;
    featuredMeta.textContent = `${movie.Year} • ${movie.Genre} • IMDB ${movie.imdbRating}`;
    featuredPlot.textContent = movie.Plot;
    setDynamicBackground(movie.Poster);
  } catch (error) {
    featuredTitle.textContent = "Movie Explorer";
    featuredMeta.textContent = "Start exploring movies right away.";
    featuredPlot.textContent = "Type a movie name in the search box to view details.";
  }
}

function setDynamicBackground(posterUrl) {
  if (!posterUrl || posterUrl === "N/A") return;
  const enhancedUrl = getHigherQualityPosterUrl(posterUrl);

  // Do not switch background until image is confirmed loadable.
  const image = new Image();
  image.onload = () => {
    // Skip tiny images that look pixelated on fullscreen backgrounds.
    if (image.naturalWidth < 500) return;
    if (currentBackground === enhancedUrl) return;
    currentBackground = enhancedUrl;
    document.body.classList.add("bg-transition");
    document.documentElement.style.setProperty("--hero-bg", `url("${enhancedUrl}")`);
    setTimeout(() => {
      document.body.classList.remove("bg-transition");
    }, 360);
  };
  image.src = enhancedUrl;
}

function getHigherQualityPosterUrl(url) {
  // Many OMDB posters come from Amazon with "_SX300" style size tokens.
  // Removing them often returns a much higher resolution variant.
  if (url.includes("m.media-amazon.com")) {
    return url
      .replace(/\._V1_.*\.jpg$/i, "._V1_.jpg")
      .replace(/\._V1_.*\.png$/i, "._V1_.png");
  }
  return url;
}

async function getMovieDetail(imdbID) {
  if (movieDetailCache[imdbID]) return movieDetailCache[imdbID];
  const res = await fetch(
    `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(imdbID)}`
  );
  const detail = await res.json();
  movieDetailCache[imdbID] = detail;
  return detail;
}

function populateYearFilter(movies) {
  const years = [...new Set(
    movies
      .map((m) => (m.Year || "").match(/\d{4}/)?.[0])
      .filter(Boolean)
  )].sort((a, b) => Number(b) - Number(a));

  yearFilter.innerHTML = `
    <option value="">All Years</option>
    ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
  `;
}

// RECENT SEARCHES
function saveRecent(name) {
  let data = JSON.parse(localStorage.getItem("recent")) || [];

  data.unshift(name);
  data = [...new Set(data)].slice(0, 5);

  localStorage.setItem("recent", JSON.stringify(data));
  localStorage.setItem("lastSearch", name);
  renderSearchHistoryUI(data);
  loadRecent();
}

async function loadRecent() {
  let data = JSON.parse(localStorage.getItem("recent")) || [];
  renderSearchHistoryUI(data);

  if (!data.length) {
    recentContainer.innerHTML = `<p class="empty-state">No recent searches yet.</p>`;
    return;
  }
  renderSkeletonStrip(recentContainer, Math.min(data.length, 5));

  const movies = await Promise.all(
    data.map(async (name) => {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(name)}`
      );
      return res.json();
    })
  );

  recentContainer.innerHTML = movies
    .filter((m) => m.Response !== "False" && m.Poster !== "N/A")
    .map((m) => createMovieCard(m))
    .join("");
}

// TRENDING
async function loadTrending() {
  renderSkeletonStrip(trendingContainer, 5);
  const movies = await Promise.all(
    trending.map(async (name) => {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(name)}`
      );
      return res.json();
    })
  );

  trendingContainer.innerHTML = movies
    .filter((m) => m.Response !== "False" && m.Poster !== "N/A")
    .map((m) => createMovieCard(m))
    .join("");
}

function createMovieCard(movie) {
  const safeTitle = movie.Title.replace(/'/g, "\\'");
  const plot = movie.Plot && movie.Plot !== "N/A"
    ? movie.Plot
    : "Click to see more details.";
  const typeText = movie.Type ? movie.Type.toUpperCase() : "TITLE";
  const ratingText = movie.imdbRating && movie.imdbRating !== "N/A" ? `IMDb ${movie.imdbRating}` : "IMDb -";

  return `
    <article class="card" onclick="openMovie('${safeTitle}')">
      <img src="${movie.Poster}" alt="${movie.Title} poster" />
      <div class="card-content">
        <span class="title">${movie.Title}</span>
        <span class="meta">${movie.Year || ""}</span>
      </div>
      <div class="card-preview">
        <div class="preview-top">
          <span>${typeText}</span>
          <span>${ratingText}</span>
        </div>
        <div class="preview-plot">${plot}</div>
      </div>
    </article>
  `;
}

function hydrateSearchState() {
  const lastSearch = localStorage.getItem("lastSearch") || "";
  if (lastSearch) {
    searchInput.value = lastSearch;
  }
  const recent = JSON.parse(localStorage.getItem("recent")) || [];
  renderSearchHistoryUI(recent);
}

function renderSearchHistoryUI(items) {
  if (!items.length) {
    recentSearchList.innerHTML = "";
    searchHistoryInline.innerHTML = "";
    clearHistoryBtn.style.display = "none";
    return;
  }

  clearHistoryBtn.style.display = "inline-flex";

  recentSearchList.innerHTML = items
    .map((item) => `<option value="${escapeHtml(item)}"></option>`)
    .join("");

  searchHistoryInline.innerHTML = items
    .map((item) => `<button class="history-chip" type="button" data-search="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
    .join("");

  searchHistoryInline.querySelectorAll(".history-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const query = chip.dataset.search || "";
      searchInput.value = query;
      searchMovies(query);
    });
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSkeletonStrip(container, count) {
  container.innerHTML = Array.from({ length: count })
    .map(() => `
      <article class="skeleton-card">
        <div class="skeleton-poster"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </article>
    `)
    .join("");
}