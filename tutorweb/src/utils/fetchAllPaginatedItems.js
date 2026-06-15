export async function fetchAllPaginatedItems(url, options = {}) {
  const {
    pageSize = 100,
    itemKey = "items",
    maxPages = 100,
    fetchOptions,
  } = options;

  const allItems = [];
  const baseUrl = new URL(url, window.location.origin);

  for (let page = 1; page <= maxPages; page += 1) {
    const pagedUrl = new URL(baseUrl.toString());
    pagedUrl.searchParams.set("page", String(page));
    pagedUrl.searchParams.set("limit", String(pageSize));

    const response = await fetch(pagedUrl.toString(), fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data?.[itemKey])
        ? data[itemKey]
        : [];

    allItems.push(...items);

    if (!data?.pagination || !data.pagination.hasMore || items.length === 0) {
      break;
    }
  }

  return allItems;
}
