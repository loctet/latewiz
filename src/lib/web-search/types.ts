export type WebSearchProvider = "tavily" | "serper" | "none";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchContext = {
  query: string;
  searchedAt: string;
  results: WebSearchResult[];
  provider: WebSearchProvider;
  answer?: string;
  error?: string;
};
