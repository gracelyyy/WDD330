
"use strict";

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const productGrid = document.querySelector("#product-grid");
const favoritesGrid = document.querySelector("#favorites-grid");
const statusMessage = document.querySelector("#status-message");

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  statusMessage.textContent =
    `Search is ready for: ${searchInput.value.trim() || "all products"}`;
});

categoryFilter.addEventListener("change", () => {
  statusMessage.textContent =
    `Selected category: ${categoryFilter.value}`;
});

productGrid.innerHTML = "";
favoritesGrid.innerHTML = "";
