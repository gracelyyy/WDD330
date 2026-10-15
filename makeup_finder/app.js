
"use strict";

/* =========================================
   BLUSH FINDER
   Makeup API + Open Beauty Facts
   Favourites saved with localStorage
========================================= */

const MAKEUP_API =
  "https://makeup-api.herokuapp.com/api/v1/products.json";

const BEAUTY_API =
  "https://world.openbeautyfacts.org/cgi/search.pl";

const STORAGE_KEY = "blushFinderFavorites";
const PAGE_SIZE = 24;

// HTML elements
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const sourceFilter = document.querySelector("#source-filter");
const clearFiltersButton = document.querySelector("#clear-filters");
const productGrid = document.querySelector("#product-grid");
const favoritesGrid = document.querySelector("#favorites-grid");
const statusMessage = document.querySelector("#status-message");
const resultsTitle = document.querySelector("#results-title");
const resultsCount = document.querySelector("#results-count");
const favoriteCount = document.querySelector("#favorite-count");
const emptyFavorites = document.querySelector("#empty-favorites");
const loadMoreButton = document.querySelector("#load-more");
const productDialog = document.querySelector("#product-dialog");
const dialogContent = document.querySelector("#dialog-content");
const closeDialogButton = document.querySelector("#close-dialog");

// Application state
let allProducts = [];
let displayedProducts = [];
let favorites = loadFavorites();
let visibleCount = PAGE_SIZE;
let searchNumber = 0;

/* =========================================
   GENERAL HELPERS
========================================= */

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase();
}

function formatCategory(value) {
  const category = cleanText(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ");

  if (!category) {
    return "Beauty";
  }

  return category.replace(/\b\w/g, letter => letter.toUpperCase());
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function safeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}

function stableId(source, id) {
  return `${source}-${String(id)}`;
}

/* =========================================
   LOCAL STORAGE
========================================= */

function loadFavorites() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.source === "string"
    );
  } catch (error) {
    console.warn("Could not read saved favourites:", error);
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    updateFavoriteCount();
    renderFavorites();
  } catch (error) {
    console.error("Could not save favourites:", error);

    statusMessage.textContent =
      "Your browser could not save favourites. Check your browser storage settings.";
  }
}

function isFavorite(productId) {
  return favorites.some(item => item.id === productId);
}

function toggleFavorite(product) {
  if (isFavorite(product.id)) {
    favorites = favorites.filter(item => item.id !== product.id);
    statusMessage.textContent = `${product.name} removed from favourites.`;
  } else {
    favorites.push(product);
    statusMessage.textContent = `${product.name} added to favourites.`;
  }

  saveFavorites();
  renderProducts();
}

function updateFavoriteCount() {
  favoriteCount.textContent = String(favorites.length);
}

/* =========================================
   THE MAKEUP API
========================================= */

async function fetchMakeupProducts(query, category) {
  const url = new URL(MAKEUP_API);

  // The Makeup API supports product_type filtering.
  if (category !== "all") {
    url.searchParams.set("product_type", category);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Makeup API returned ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected Makeup API response.");
  }

  const normalizedQuery = normalizeText(query);

  return data
    .map(item => ({
      id: stableId("makeup", item.id),
      source: "makeup",
      name: cleanText(item.name) || "Unnamed makeup product",
      brand: cleanText(item.brand) || "Brand not listed",
      category: cleanText(item.product_type) || "makeup",
      price: cleanText(item.price),
      currency: "$",
      image: safeUrl(item.image_link),
      description: cleanText(item.description),
      website: safeUrl(item.product_link),
      ingredients: cleanText(item.ingredient),
      rating: item.rating,
      barcode: ""
    }))
    .filter(product => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        product.name,
        product.brand,
        product.category,
        product.description
      ].some(value => normalizeText(value).includes(normalizedQuery));
    });
}

/* =========================================
   OPEN BEAUTY FACTS
========================================= */

async function fetchBeautyFacts(query, category) {
  const url = new URL(BEAUTY_API);

  // Search by the entered phrase or a beauty-related default.
  const terms = query || (
    category !== "all"
      ? category.replaceAll("_", " ")
      : "makeup"
  );

  url.searchParams.set("search_terms", terms);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("fields", [
    "code",
    "product_name",
    "brands",
    "categories",
    "image_front_url",
    "image_url",
    "ingredients_text",
    "url"
  ].join(","));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open Beauty Facts returned ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.products)) {
    throw new Error("Unexpected Open Beauty Facts response.");
  }

  const normalizedQuery = normalizeText(query);

  return data.products
    .filter(item => cleanText(item.product_name))
    .map(item => {
      const categoryText = cleanText(item.categories);

      return {
        id: stableId("openbeauty", item.code || item.product_name),
        source: "openbeauty",
        name: cleanText(item.product_name),
        brand: cleanText(item.brands) || "Brand not listed",
        category: categoryText || "beauty",
        price: "",
        currency: "",
        image: safeUrl(item.image_front_url || item.image_url),
        description: "",
        website: safeUrl(item.url),
        ingredients: cleanText(item.ingredients_text),
        rating: null,
        barcode: cleanText(item.code)
      };
    })
    .filter(product => {
      if (normalizedQuery) {
        const matchesSearch = [
          product.name,
          product.brand,
          product.category
        ].some(value => normalizeText(value).includes(normalizedQuery));

        if (!matchesSearch) {
          return false;
        }
      }

      if (category !== "all") {
        const categoryWords = normalizeText(product.category);
        const requestedCategory = normalizeText(
          category.replaceAll("_", " ")
        );

        if (!categoryWords.includes(requestedCategory)) {
          return false;
        }
      }

      return true;
    });
}

/* =========================================
   SEARCH AND FILTER
========================================= */

function getCurrentFilters() {
  return {
    query: searchInput.value.trim(),
    category: categoryFilter.value,
    source: sourceFilter.value
  };
}

async function searchProducts() {
  const requestNumber = ++searchNumber;
  const { query, category, source } = getCurrentFilters();

  visibleCount = PAGE_SIZE;
  productGrid.replaceChildren();
  resultsCount.textContent = "";
  loadMoreButton.hidden = true;
  statusMessage.textContent = "Finding your beauty favourites...";

  resultsTitle.textContent = query
    ? `Results for "${query}"`
    : "Explore the collection";

  const tasks = [];

  if (source === "all" || source === "makeup") {
    tasks.push({
      source: "makeup",
      promise: fetchMakeupProducts(query, category)
    });
  }

  if (source === "all" || source === "openbeauty") {
    tasks.push({
      source: "openbeauty",
      promise: fetchBeautyFacts(query, category)
    });
  }

  const settled = await Promise.allSettled(
    tasks.map(task => task.promise)
  );

  // Ignore outdated searches if a newer request has started.
  if (requestNumber !== searchNumber) {
    return;
  }

  const products = [];
  const failures = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      products.push(...result.value);
    } else {
      failures.push(tasks[index].source);
      console.warn(
        `${tasks[index].source} could not load:`,
        result.reason
      );
    }
  });

  // Remove duplicate product IDs.
  const uniqueProducts = [
    ...new Map(products.map(item => [item.id, item])).values()
  ];

  allProducts = uniqueProducts;

  renderProducts();

  if (allProducts.length === 0 && failures.length === tasks.length) {
    statusMessage.textContent =
      "We couldn't connect to the product services. Check your internet connection or try again later.";
  } else if (allProducts.length === 0) {
    statusMessage.textContent =
      "No matching products were found. Try a different search or category.";
  } else if (failures.length > 0) {
    statusMessage.textContent =
      `Showing available results. Some sources could not load: ${failures.join(", ")}.`;
  } else {
    statusMessage.textContent =
      `Found ${allProducts.length} product${allProducts.length === 1 ? "" : "s"}. Explore away!`;
  }
}

/* =========================================
   PRODUCT CARDS
========================================= */

function createProductCard(product, favoriteView = false) {
  const card = createElement("article", "product-card");
  const imageWrap = createElement("div", "product-image-wrap");

  if (product.image) {
    const image = createElement("img", "product-image");
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";

    image.addEventListener("error", () => {
      const placeholder = createElement(
        "div",
        "image-placeholder",
        "♡"
      );

      placeholder.setAttribute("aria-label", "Product image unavailable");
      image.replaceWith(placeholder);
    }, { once: true });

    imageWrap.append(image);
  } else {
    imageWrap.append(
      createElement("div", "image-placeholder", "♡")
    );
  }

  const sourceName = product.source === "makeup"
    ? "The Makeup API"
    : "Open Beauty Facts";

  imageWrap.append(createElement("span", "source-badge", sourceName));

  const heart = createElement(
    "button",
    `favorite-button${isFavorite(product.id) ? " is-favorite" : ""}`,
    isFavorite(product.id) ? "♥" : "♡"
  );

  heart.type = "button";
  heart.setAttribute(
    "aria-label",
    isFavorite(product.id)
      ? `Remove ${product.name} from favourites`
      : `Add ${product.name} to favourites`
  );

  heart.setAttribute("aria-pressed", String(isFavorite(product.id)));

  heart.addEventListener("click", () => {
    toggleFavorite(product);
  });

  imageWrap.append(heart);

  const info = createElement("div", "product-info");

  info.append(
    createElement("p", "product-category", formatCategory(product.category)),
    createElement("h3", "product-name", product.name),
    createElement("p", "product-brand", product.brand)
  );

  if (product.price && Number.isFinite(Number(product.price))) {
    info.append(
      createElement(
        "p",
        "product-price",
        `${product.currency}${Number(product.price).toFixed(2)}`
      )
    );
  }

  const actions = createElement("div", "product-actions");
  const detailsButton = createElement(
    "button",
    "details-button",
    "View details"
  );

  detailsButton.type = "button";
  detailsButton.addEventListener("click", () => {
    openProductDetails(product);
  });

  actions.append(detailsButton);

  if (favoriteView) {
    const removeButton = createElement(
      "button",
      "details-button",
      "Remove ♡"
    );

    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      toggleFavorite(product);
    });

    actions.append(removeButton);
  }

  info.append(actions);
  card.append(imageWrap, info);

  return card;
}

function renderProducts() {
  productGrid.replaceChildren();

  displayedProducts = allProducts.slice(0, visibleCount);

  displayedProducts.forEach(product => {
    productGrid.append(createProductCard(product));
  });

  resultsCount.textContent =
    `${allProducts.length} product${allProducts.length === 1 ? "" : "s"}`;

  loadMoreButton.hidden = visibleCount >= allProducts.length;
}

function renderFavorites() {
  favoritesGrid.replaceChildren();

  favorites.forEach(product => {
    favoritesGrid.append(createProductCard(product, true));
  });

  emptyFavorites.hidden = favorites.length > 0;
  favoritesGrid.hidden = favorites.length === 0;
  updateFavoriteCount();
}

/* =========================================
   PRODUCT DETAILS DIALOG
========================================= */

function openProductDetails(product) {
  dialogContent.replaceChildren();

  if (product.image) {
    const image = createElement("img", "dialog-product-image");
    image.src = product.image;
    image.alt = product.name;

    image.addEventListener("error", () => {
      image.remove();
    }, { once: true });

    dialogContent.append(image);
  }

  dialogContent.append(
    createElement("p", "eyebrow", formatCategory(product.category)),
    createElement("h2", "dialog-product-title", product.name),
    createElement("p", "product-brand", `Brand: ${product.brand}`)
  );

  if (product.price && Number.isFinite(Number(product.price))) {
    dialogContent.append(
      createElement(
        "p",
        "product-price",
        `Price: ${product.currency}${Number(product.price).toFixed(2)}`
      )
    );
  }

  if (product.description) {
    dialogContent.append(
      createElement("h3", "", "About this product"),
      createElement("p", "dialog-description", product.description)
    );
  }

  if (product.ingredients) {
    dialogContent.append(
      createElement("h3", "", "Ingredients"),
      createElement("p", "dialog-description", product.ingredients)
    );
  }

  const meta = createElement("div", "dialog-meta");
  meta.append(
    createElement(
      "p",
      "",
      `Data source: ${
        product.source === "makeup"
          ? "The Makeup API"
          : "Open Beauty Facts"
      }`
    )
  );

  if (product.barcode) {
    meta.append(
      createElement("p", "", `Barcode: ${product.barcode}`)
    );
  }

  dialogContent.append(meta);

  if (product.website) {
    const link = createElement("a", "dialog-link", "View original product ↗");
    link.href = product.website;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    dialogContent.append(link);
  }

  const saveButton = createElement(
    "button",
    "primary-button",
    isFavorite(product.id)
      ? "Remove from favourites ♥"
      : "Save to favourites ♡"
  );

  saveButton.type = "button";

  saveButton.addEventListener("click", () => {
    toggleFavorite(product);
    saveButton.textContent = isFavorite(product.id)
      ? "Remove from favourites ♥"
      : "Save to favourites ♡";
  });

  dialogContent.append(saveButton);

  if (typeof productDialog.showModal === "function") {
    productDialog.showModal();
  } else {
    productDialog.setAttribute("open", "");
  }
}

/* =========================================
   EVENT LISTENERS
========================================= */

searchForm.addEventListener("submit", event => {
  event.preventDefault();
  searchProducts();
});

categoryFilter.addEventListener("change", searchProducts);
sourceFilter.addEventListener("change", searchProducts);

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "all";
  sourceFilter.value = "all";
  searchProducts();
});

loadMoreButton.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderProducts();
});

closeDialogButton.addEventListener("click", () => {
  productDialog.close();
});

productDialog.addEventListener("click", event => {
  if (event.target === productDialog) {
    productDialog.close();
  }
});

/* =========================================
   INITIALIZE APP
========================================= */

updateFavoriteCount();
renderFavorites();
searchProducts();
